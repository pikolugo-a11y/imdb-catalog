import 'server-only';
import {db} from './db';
import {startProcessRun,addProcessEvent,finishProcessRun} from './process-runtime';
import {getActiveBatch,getLatestBatch} from './batch-engine';

const PROCESS='PROC-MOV-001';

export async function selectMov001BatchEligibleIds(sql=db()){
  const rows=await sql`SELECT cl.imdb_id FROM catalog_lifecycle cl JOIN movies m ON m.imdb_id=cl.imdb_id JOIN plex_catalog_status pcs ON pcs.imdb_id=cl.imdb_id AND pcs.status='in_plex' JOIN plex_items p ON p.rating_key=pcs.rating_key AND p.active AND p.item_type='movie' LEFT JOIN catalog_exclusions ex ON ex.imdb_id=cl.imdb_id WHERE cl.lifecycle_state='MOVIE_FILE_PENDING' AND ex.imdb_id IS NULL ORDER BY cl.imdb_id`;
  return rows.map(r=>r.imdb_id);
}

async function appendEligible(sql,runId,ids){if(!ids.length)return 0;const existing=await sql`SELECT entity_id FROM batch_run_items WHERE batch_run_id=${runId}::uuid AND entity_type='movie'`,have=new Set(existing.map(x=>String(x.entity_id))),missing=ids.filter(id=>!have.has(String(id)));if(!missing.length)return 0;const[maxRow]=await sql`SELECT COALESCE(max(position),-1)::int max_position FROM batch_run_items WHERE batch_run_id=${runId}::uuid`,base=Number(maxRow?.max_position??-1)+1;await sql`INSERT INTO batch_run_items(batch_run_id,entity_type,entity_id,position,status) SELECT ${runId}::uuid,'movie',x.entity_id,${base}+(x.ord-1)::int,'queued' FROM unnest(${missing}::text[]) WITH ORDINALITY AS x(entity_id,ord) ON CONFLICT(batch_run_id,entity_type,entity_id) DO NOTHING`;const[counts]=await sql`SELECT count(*)::int total,count(*) FILTER(WHERE status IN('queued','leased','running'))::int pending FROM batch_run_items WHERE batch_run_id=${runId}::uuid`;await sql`UPDATE process_runs SET items_total=${Number(counts?.total||0)},items_pending=${Number(counts?.pending||0)},updated_at=now() WHERE run_id=${runId}::uuid`;await addProcessEvent(runId,{eventType:'batch_items_appended',message:`${missing.length} películas añadidas a MOV-001`,data:{items_added:missing.length,items_total:Number(counts?.total||0)}});return missing.length}

export async function getMov001BatchPanelState(){
  const sql=db();
  const [ids,active,latest,[engine]]=await Promise.all([
    selectMov001BatchEligibleIds(sql),
    getActiveBatch(PROCESS,sql),
    getLatestBatch(PROCESS,sql),
    sql`SELECT desired_state,pause_reason,changed_at FROM batch_engine_control WHERE singleton_id=1`
  ]);
  return{eligibleCount:ids.length,active,latest,engine:engine||{desired_state:'running'}};
}

export async function startMov001Batch({concurrency=8,limit=null,triggerSource='calidad_peliculas_batch'}={}){
  const sql=db();
  let ids=await selectMov001BatchEligibleIds(sql);if(limit!=null)ids=ids.slice(0,Math.max(1,Math.min(Number(limit)||1,10000)));
  const active=await getActiveBatch(PROCESS,sql);if(active){const appended=active.desired_state==='cancel_requested'?0:await appendEligible(sql,active.run_id,ids);return{run:await getActiveBatch(PROCESS,sql),reused:true,appended,eligibleCount:Number(active.items_pending||0)+appended}};
  if(!ids.length)return{run:null,reused:false,empty:true,eligibleCount:0};
  const requestedConcurrency=Math.max(1,Math.min(Number(concurrency)||8,32));
  const correlationKey=`${PROCESS}:batch:${Date.now()}`;
  const started=await startProcessRun({processCode:PROCESS,runKind:'batch',triggerSource,executor:'railway_batch_fast',entityType:'movie_set',entityId:'movie_file_pending',correlationKey,idempotencyKey:correlationKey,context:{surface:'/calidad/peliculas',operation:'batch_validate_movie_files',worker_pool:'fast',selection:'MOVIE_FILE_PENDING',requested_concurrency:requestedConcurrency,automatic:triggerSource==='plex_sync_continuation'||triggerSource==='quality_scheduler'}});
  const runId=started.run.run_id;
  try{
    await sql`INSERT INTO batch_run_control(run_id,process_code,worker_pool,desired_state,requested_concurrency) VALUES(${runId}::uuid,${PROCESS},'fast','running',${requestedConcurrency})`;
    await sql`INSERT INTO batch_run_items(batch_run_id,entity_type,entity_id,position,status) SELECT ${runId}::uuid,'movie',x.entity_id,(x.ord-1)::int,'queued' FROM unnest(${ids}::text[]) WITH ORDINALITY AS x(entity_id,ord)`;
    await sql`UPDATE process_runs SET items_total=${ids.length},items_processed=0,items_succeeded=0,items_failed=0,items_pending=${ids.length},updated_at=now() WHERE run_id=${runId}::uuid`;
    await addProcessEvent(runId,{eventType:'batch_queued',message:'Batch MOV-001 preparado',data:{items_total:ids.length,worker_pool:'fast',requested_concurrency:requestedConcurrency,selection:'MOVIE_FILE_PENDING',automatic:triggerSource==='plex_sync_continuation'||triggerSource==='quality_scheduler'}});
    return{run:await getActiveBatch(PROCESS,sql),reused:false,empty:false,eligibleCount:ids.length};
  }catch(error){
    await finishProcessRun(runId,{technicalStatus:'failed',message:'No se pudo preparar la cola Batch MOV-001'}).catch(()=>{});
    if(error?.code==='23505'){const existing=await getActiveBatch(PROCESS,sql);if(existing){const appended=await appendEligible(sql,existing.run_id,ids);return{run:await getActiveBatch(PROCESS,sql),reused:true,appended,eligibleCount:Number(existing.items_pending||0)+appended}}}
    throw error;
  }
}
