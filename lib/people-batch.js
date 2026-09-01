import 'server-only';
import {db} from './db';
import {startProcessRun,addProcessEvent,finishProcessRun} from './process-runtime';
import {getActiveBatch,getLatestBatch} from './batch-engine';

const PROCESS='PROC-PER-001';
export async function selectPeopleBatchEligibleIds(sql=db()){
  const rows=await sql`WITH relevant AS (
    SELECT p.tmdb_person_id,
      count(DISTINCT mc.imdb_id) FILTER(WHERE mc.credit_type='cast') cast_n,
      count(DISTINCT mc.imdb_id) FILTER(WHERE mc.credit_type='crew' AND lower(COALESCE(mc.job,''))='director') dir_n
    FROM people p JOIN movie_credits mc USING(tmdb_person_id)
    GROUP BY p.tmdb_person_id
  )
  SELECT r.tmdb_person_id
  FROM relevant r LEFT JOIN person_refresh_state s USING(tmdb_person_id)
  WHERE (r.cast_n>5 OR r.dir_n>5)
    AND (s.filmography_refreshed_at IS NULL OR s.filmography_refreshed_at<=now()-interval '30 days' OR s.last_error IS NOT NULL)
  ORDER BY s.filmography_refreshed_at NULLS FIRST,r.tmdb_person_id`;
  return rows.map(r=>String(r.tmdb_person_id));
}
async function sourceState(sql){const[row]=await sql`SELECT l.*,u.batch_calls,u.manual_calls,u.rate_limited,u.errors FROM batch_api_source_limits l LEFT JOIN batch_api_source_usage u ON u.source=l.source AND u.usage_date=(now() AT TIME ZONE 'UTC')::date WHERE l.source='tmdb'`;return row||null}
export async function getPeopleBatchPanelState(){const sql=db();const[ids,active,latest,[engine],tmdb]=await Promise.all([selectPeopleBatchEligibleIds(sql),getActiveBatch(PROCESS,sql),getLatestBatch(PROCESS,sql),sql`SELECT desired_state,pause_reason,changed_at FROM batch_engine_control WHERE singleton_id=1`,sourceState(sql)]);return{eligibleCount:ids.length,active,latest,engine:engine||{desired_state:'running'},tmdb}}
export async function startPeopleBatch({limit=null,concurrency=2}={}){
  const sql=db(),active=await getActiveBatch(PROCESS,sql);if(active)return{run:active,reused:true,eligibleCount:Number(active.items_pending||0)};
  let ids=await selectPeopleBatchEligibleIds(sql);if(limit!=null)ids=ids.slice(0,Math.max(1,Math.min(Number(limit)||1,10000)));if(!ids.length)return{run:null,reused:false,empty:true,eligibleCount:0};
  const requestedConcurrency=Math.max(1,Math.min(Number(concurrency)||2,2)),correlationKey=`${PROCESS}:batch:${Date.now()}`;
  const started=await startProcessRun({processCode:PROCESS,runKind:'batch',triggerSource:'calidad_personas_batch',executor:'railway_batch_api',entityType:'person_set',entityId:'people_maintenance',correlationKey,idempotencyKey:correlationKey,context:{surface:'/calidad/personas',operation:'batch_refresh_people',worker_pool:'api',selection:'pending_30d',requested_concurrency:requestedConcurrency}}),runId=started.run.run_id;
  try{
    await sql`INSERT INTO batch_run_control(run_id,process_code,worker_pool,desired_state,requested_concurrency) VALUES(${runId}::uuid,${PROCESS},'api','running',${requestedConcurrency})`;
    await sql`INSERT INTO batch_run_items(batch_run_id,entity_type,entity_id,position,status) SELECT ${runId}::uuid,'person',x.entity_id,(x.ord-1)::int,'queued' FROM unnest(${ids}::text[]) WITH ORDINALITY AS x(entity_id,ord)`;
    await sql`UPDATE process_runs SET items_total=${ids.length},items_processed=0,items_succeeded=0,items_failed=0,items_pending=${ids.length},updated_at=now() WHERE run_id=${runId}::uuid`;
    await addProcessEvent(runId,{eventType:'batch_queued',message:'Batch PER-001 preparado',data:{items_total:ids.length,worker_pool:'api',requested_concurrency:requestedConcurrency,selection:'pending_30d'}});
    return{run:await getActiveBatch(PROCESS,sql),reused:false,empty:false,eligibleCount:ids.length};
  }catch(error){await finishProcessRun(runId,{technicalStatus:'failed',message:'No se pudo preparar Batch de Personas'}).catch(()=>{});if(error?.code==='23505'){const existing=await getActiveBatch(PROCESS,sql);if(existing)return{run:existing,reused:true,eligibleCount:Number(existing.items_pending||0)}}throw error}
}
