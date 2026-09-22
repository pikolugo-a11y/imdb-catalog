import 'server-only';
import {db} from './db';
import {startProcessRun,addProcessEvent,finishProcessRun} from './process-runtime';
import {getActiveBatch,getLatestBatch} from './batch-engine';
import {PIKORELEVANCE_VERSION} from './pikorelevance-core.mjs';

export const PIKORELEVANCE_PROCESS='PROC-REL-001';
const normalizeIds=ids=>[...new Set((Array.isArray(ids)?ids:[]).map(x=>String(x||'').trim()).filter(x=>/^tt\d+$/.test(x)))];

export async function selectPikoRelevanceDueEligibleIds(sql=db()){
  const rows=await sql.query(`SELECT c.imdb_id
    FROM catalog_read_model c
    JOIN series_relevance_assessments a ON a.imdb_id=c.imdb_id AND a.formula_version=$1
    LEFT JOIN catalog_exclusions ex ON ex.imdb_id=c.imdb_id
    WHERE c.type IN ('Serie','Miniserie') AND ex.imdb_id IS NULL
      AND a.next_review_at IS NOT NULL AND a.next_review_at<=now()
    ORDER BY a.next_review_at ASC,c.final_rating DESC NULLS LAST,c.imdb_id ASC`,[PIKORELEVANCE_VERSION]);
  return rows.map(r=>String(r.imdb_id));
}

export async function selectPikoRelevanceMissingEligibleIds(sql=db(),{limit=10000}={}){
  const safe=Math.max(1,Math.min(Number(limit)||10000,10000));
  const rows=await sql.query(`SELECT c.imdb_id
    FROM catalog_read_model c
    LEFT JOIN series_relevance_assessments a ON a.imdb_id=c.imdb_id AND a.formula_version=$1
    LEFT JOIN catalog_exclusions ex ON ex.imdb_id=c.imdb_id
    WHERE c.type IN ('Serie','Miniserie') AND ex.imdb_id IS NULL AND a.imdb_id IS NULL
    ORDER BY c.final_rating DESC NULLS LAST,c.year DESC NULLS LAST,c.imdb_id ASC LIMIT $2`,[PIKORELEVANCE_VERSION,safe]);
  return rows.map(r=>String(r.imdb_id));
}

async function selectExplicit(sql,ids){
  const requested=normalizeIds(ids);
  if(!requested.length)throw new Error('Selecciona al menos una serie válida');
  const rows=await sql`SELECT c.imdb_id FROM catalog_read_model c LEFT JOIN catalog_exclusions ex ON ex.imdb_id=c.imdb_id WHERE c.imdb_id=ANY(${requested}::text[]) AND c.type IN ('Serie','Miniserie') AND ex.imdb_id IS NULL`;
  const valid=new Set(rows.map(r=>String(r.imdb_id)));
  const invalid=requested.filter(id=>!valid.has(id));
  if(invalid.length)throw new Error('Alguna serie seleccionada ya no está disponible para PikoRelevancia');
  return requested;
}

async function appendItems(sql,runId,ids){
  if(!ids.length)return 0;
  const existing=await sql`SELECT entity_id FROM batch_run_items WHERE batch_run_id=${runId}::uuid AND entity_type='series'`;
  const have=new Set(existing.map(x=>String(x.entity_id))),missing=ids.filter(id=>!have.has(id));
  if(!missing.length)return 0;
  const[maxRow]=await sql`SELECT COALESCE(max(position),-1)::int max_position FROM batch_run_items WHERE batch_run_id=${runId}::uuid`;
  const base=Number(maxRow?.max_position??-1)+1;
  await sql`INSERT INTO batch_run_items(batch_run_id,entity_type,entity_id,position,status)
    SELECT ${runId}::uuid,'series',x.entity_id,${base}+(x.ord-1)::int,'queued'
    FROM unnest(${missing}::text[]) WITH ORDINALITY AS x(entity_id,ord)
    ON CONFLICT(batch_run_id,entity_type,entity_id) DO NOTHING`;
  const[counts]=await sql`SELECT count(*)::int total,count(*) FILTER(WHERE status IN('queued','leased','running'))::int pending FROM batch_run_items WHERE batch_run_id=${runId}::uuid`;
  await sql`UPDATE process_runs SET items_total=${Number(counts?.total||0)},items_pending=${Number(counts?.pending||0)},updated_at=now() WHERE run_id=${runId}::uuid`;
  await addProcessEvent(runId,{eventType:'batch_items_appended',message:`${missing.length} series añadidas a PikoRelevancia`,data:{items_added:missing.length,items_total:Number(counts?.total||0),requested_concurrency:1}});
  return missing.length;
}

export async function getPikoRelevanceBatchState(){
  const sql=db();
  const [due,active,latest]=await Promise.all([selectPikoRelevanceDueEligibleIds(sql),getActiveBatch(PIKORELEVANCE_PROCESS,sql),getLatestBatch(PIKORELEVANCE_PROCESS,sql)]);
  return{processCode:PIKORELEVANCE_PROCESS,eligibleCount:due.length,active,latest,concurrency:1,pool:'api'};
}

export async function startPikoRelevanceBatch({entityIds=null,limit=null,triggerSource='quality_scheduler'}={}){
  const sql=db(),targeted=entityIds!==null;
  let ids=targeted?await selectExplicit(sql,entityIds):await selectPikoRelevanceDueEligibleIds(sql);
  if(limit!=null)ids=ids.slice(0,Math.max(1,Math.min(Number(limit)||1,250)));
  const active=await getActiveBatch(PIKORELEVANCE_PROCESS,sql);
  if(active){
    const appended=active.desired_state==='cancel_requested'?0:await appendItems(sql,active.run_id,ids);
    return{run:await getActiveBatch(PIKORELEVANCE_PROCESS,sql),reused:true,appended,eligibleCount:Number(active.items_pending||0)+appended,targeted};
  }
  if(!ids.length)return{run:null,reused:false,empty:true,eligibleCount:0,targeted};
  const source=String(triggerSource||'quality_scheduler'),correlationKey=`${PIKORELEVANCE_PROCESS}:batch:${Date.now()}`;
  const started=await startProcessRun({
    processCode:PIKORELEVANCE_PROCESS,runKind:'batch',triggerSource:source,executor:'railway_batch_api',
    entityType:'series_set',entityId:targeted?'manual_selection':'due_refresh',correlationKey,idempotencyKey:correlationKey,
    context:{surface:'/calidad/relevancia',operation:'batch_calculate_pikorelevancia',formula_version:PIKORELEVANCE_VERSION,worker_pool:'api',requested_concurrency:1,automatic:source==='quality_scheduler',targeted}
  });
  const runId=started.run.run_id;
  try{
    await sql`INSERT INTO batch_run_control(run_id,process_code,worker_pool,desired_state,requested_concurrency) VALUES(${runId}::uuid,${PIKORELEVANCE_PROCESS},'api','running',1)`;
    await sql`INSERT INTO batch_run_items(batch_run_id,entity_type,entity_id,position,status)
      SELECT ${runId}::uuid,'series',x.entity_id,(x.ord-1)::int,'queued' FROM unnest(${ids}::text[]) WITH ORDINALITY AS x(entity_id,ord)`;
    await sql`UPDATE process_runs SET items_total=${ids.length},items_processed=0,items_succeeded=0,items_failed=0,items_pending=${ids.length},updated_at=now() WHERE run_id=${runId}::uuid`;
    await addProcessEvent(runId,{eventType:'batch_queued',message:'PikoRelevancia encolada',data:{items_total:ids.length,worker_pool:'api',requested_concurrency:1,formula_version:PIKORELEVANCE_VERSION,automatic:source==='quality_scheduler',targeted}});
    return{run:await getActiveBatch(PIKORELEVANCE_PROCESS,sql),reused:false,eligibleCount:ids.length,targeted};
  }catch(error){
    await finishProcessRun(runId,{technicalStatus:'failed',message:'No se pudo preparar PikoRelevancia'}).catch(()=>{});
    if(error?.code==='23505'){
      const existing=await getActiveBatch(PIKORELEVANCE_PROCESS,sql);
      if(existing){
        const appended=await appendItems(sql,existing.run_id,ids);
        return{run:await getActiveBatch(PIKORELEVANCE_PROCESS,sql),reused:true,appended,eligibleCount:Number(existing.items_pending||0)+appended,targeted};
      }
    }
    throw error;
  }
}
