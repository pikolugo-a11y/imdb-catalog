import 'server-only';
import {db} from './db';
import {startProcessRun,addProcessEvent,finishProcessRun} from './process-runtime';
import {getActiveBatch,getLatestBatch} from './batch-engine';

const PROCESS='PROC-DATA-001';
export async function selectData001BatchEligibleIds(sql=db()){
  const rows=await sql.query(`SELECT m.imdb_id
    FROM catalog_lifecycle cl
    JOIN movies m USING(imdb_id)
    JOIN identity_validation iv USING(imdb_id)
    LEFT JOIN catalog_exclusions ex USING(imdb_id)
    WHERE cl.lifecycle_state='DATA_INCOMPLETE'
      AND ex.imdb_id IS NULL
      AND iv.validation_status='valid'
      AND m.imdb_id ~ '^tt[0-9]+$'
    ORDER BY m.imdb_id`);
  return rows.map(r=>r.imdb_id);
}
async function sourceState(sql,source){const[row]=await sql`SELECT l.*,u.batch_calls,u.manual_calls,u.rate_limited,u.errors FROM batch_api_source_limits l LEFT JOIN batch_api_source_usage u ON u.source=l.source AND u.usage_date=(now() AT TIME ZONE 'UTC')::date WHERE l.source=${source}`;return row||null}
export async function getData001BatchPanelState(){const sql=db();const[ids,active,latest,[engine],tmdb,omdb,mdblist]=await Promise.all([selectData001BatchEligibleIds(sql),getActiveBatch(PROCESS,sql),getLatestBatch(PROCESS,sql),sql`SELECT desired_state,pause_reason,changed_at FROM batch_engine_control WHERE singleton_id=1`,sourceState(sql,'tmdb'),sourceState(sql,'omdb'),sourceState(sql,'mdblist')]);return{eligibleCount:ids.length,active,latest,engine:engine||{desired_state:'running'},tmdb,omdb,mdblist}}
export async function startData001Batch({limit=null,concurrency=2}={}){
  const sql=db(),active=await getActiveBatch(PROCESS,sql);if(active)return{run:active,reused:true,eligibleCount:Number(active.items_pending||0)};
  let ids=await selectData001BatchEligibleIds(sql);if(limit!=null)ids=ids.slice(0,Math.max(1,Math.min(Number(limit)||1,10000)));if(!ids.length)return{run:null,reused:false,empty:true,eligibleCount:0};
  const requestedConcurrency=Math.max(1,Math.min(Number(concurrency)||2,2)),correlationKey=`${PROCESS}:batch:${Date.now()}`;
  const started=await startProcessRun({processCode:PROCESS,runKind:'batch',triggerSource:'calidad_datos_batch',executor:'railway_batch_api',entityType:'title_set',entityId:'data_incomplete',correlationKey,idempotencyKey:correlationKey,context:{surface:'/calidad/datos',operation:'batch_complete_structural_data',worker_pool:'api',selection:'data_incomplete',requested_concurrency:requestedConcurrency}}),runId=started.run.run_id;
  try{
    await sql`INSERT INTO batch_run_control(run_id,process_code,worker_pool,desired_state,requested_concurrency) VALUES(${runId}::uuid,${PROCESS},'api','running',${requestedConcurrency})`;
    await sql`INSERT INTO batch_run_items(batch_run_id,entity_type,entity_id,position,status) SELECT ${runId}::uuid,'title',x.entity_id,(x.ord-1)::int,'queued' FROM unnest(${ids}::text[]) WITH ORDINALITY AS x(entity_id,ord)`;
    await sql`UPDATE process_runs SET items_total=${ids.length},items_processed=0,items_succeeded=0,items_failed=0,items_pending=${ids.length},updated_at=now() WHERE run_id=${runId}::uuid`;
    await addProcessEvent(runId,{eventType:'batch_queued',message:'Batch DATA-001 preparado',data:{items_total:ids.length,worker_pool:'api',requested_concurrency:requestedConcurrency,selection:'data_incomplete'}});
    return{run:await getActiveBatch(PROCESS,sql),reused:false,empty:false,eligibleCount:ids.length};
  }catch(error){
    await finishProcessRun(runId,{technicalStatus:'failed',message:'No se pudo preparar DATA-001'}).catch(()=>{});
    if(error?.code==='23505'){const existing=await getActiveBatch(PROCESS,sql);if(existing)return{run:existing,reused:true,eligibleCount:Number(existing.items_pending||0)}}
    throw error;
  }
}
