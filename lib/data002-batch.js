import 'server-only';
import {db} from './db';
import {startProcessRun,addProcessEvent,finishProcessRun} from './process-runtime';
import {getActiveBatch,getLatestBatch} from './batch-engine';

const PROCESS='PROC-DATA-002';
function freshDaysSql(){return `CASE WHEN COALESCE(mm.release_date,CASE WHEN m.year BETWEEN 1801 AND 9999 THEN make_date(m.year,1,1) END)>CURRENT_DATE-INTERVAL '3 months' THEN 14 WHEN COALESCE(mm.release_date,CASE WHEN m.year BETWEEN 1801 AND 9999 THEN make_date(m.year,1,1) END)>CURRENT_DATE-INTERVAL '1 year' THEN 30 WHEN COALESCE(mm.release_date,CASE WHEN m.year BETWEEN 1801 AND 9999 THEN make_date(m.year,1,1) END)>CURRENT_DATE-INTERVAL '3 years' THEN 90 WHEN COALESCE(mm.release_date,CASE WHEN m.year BETWEEN 1801 AND 9999 THEN make_date(m.year,1,1) END)>CURRENT_DATE-INTERVAL '10 years' THEN 180 ELSE 365 END`}
export async function selectData002BatchEligibleIds(sql=db()){
 const fresh=freshDaysSql();
 const rows=await sql.query(`WITH candidates AS (
   SELECT m.imdb_id,${fresh} AS fresh_days
   FROM catalog_lifecycle cl JOIN movies m USING(imdb_id)
   LEFT JOIN movie_metadata mm USING(imdb_id)
   LEFT JOIN catalog_exclusions ex USING(imdb_id)
   WHERE cl.lifecycle_state='PIKOSCORE_PENDING' AND ex.imdb_id IS NULL
     AND COALESCE(m.source_status #>> '{data_quality_manual_ratings,decision}','')<>'fixed_five'
 ), ratings AS (
   SELECT c.imdb_id,
     count(*) FILTER(WHERE tr.status='available' AND COALESCE(tr.normalized_rating,0)>0)::int rating_count,
     count(*) FILTER(WHERE tr.status='available' AND COALESCE(tr.normalized_rating,0)>0 AND tr.fetched_at IS NOT NULL AND LEAST(COALESCE(tr.expires_at,'infinity'::timestamptz),tr.fetched_at+(c.fresh_days||' days')::interval)>now())::int fresh_rating_count
   FROM candidates c LEFT JOIN title_ratings tr USING(imdb_id)
   GROUP BY c.imdb_id
 ) SELECT imdb_id FROM ratings WHERE fresh_rating_count<2 OR rating_count=0 OR fresh_rating_count<>rating_count ORDER BY imdb_id`);
 return rows.map(r=>r.imdb_id)
}
async function sourceState(sql,source){const[row]=await sql`SELECT l.*,u.batch_calls,u.manual_calls,u.rate_limited,u.errors FROM batch_api_source_limits l LEFT JOIN batch_api_source_usage u ON u.source=l.source AND u.usage_date=(now() AT TIME ZONE 'UTC')::date WHERE l.source=${source}`;return row||null}
export async function getData002BatchPanelState(){const sql=db();const[ids,active,latest,[engine],mdblist,omdb,tmdb]=await Promise.all([selectData002BatchEligibleIds(sql),getActiveBatch(PROCESS,sql),getLatestBatch(PROCESS,sql),sql`SELECT desired_state,pause_reason,changed_at FROM batch_engine_control WHERE singleton_id=1`,sourceState(sql,'mdblist'),sourceState(sql,'omdb'),sourceState(sql,'tmdb')]);return{eligibleCount:ids.length,active,latest,engine:engine||{desired_state:'running'},mdblist,omdb,tmdb}}
export async function startData002Batch({limit=null,concurrency=2}={}){
 const sql=db(),active=await getActiveBatch(PROCESS,sql);if(active)return{run:active,reused:true,eligibleCount:Number(active.items_pending||0)};
 let ids=await selectData002BatchEligibleIds(sql);if(limit!=null)ids=ids.slice(0,Math.max(1,Math.min(Number(limit)||1,10000)));if(!ids.length)return{run:null,reused:false,empty:true,eligibleCount:0};
 const requestedConcurrency=Math.max(1,Math.min(Number(concurrency)||2,2)),correlationKey=`${PROCESS}:batch:${Date.now()}`;
 const started=await startProcessRun({processCode:PROCESS,runKind:'batch',triggerSource:'calidad_datos_batch',executor:'railway_batch_api',entityType:'title_set',entityId:'ratings_pending',correlationKey,idempotencyKey:correlationKey,context:{surface:'/calidad/datos',operation:'batch_refresh_ratings',worker_pool:'api',selection:'ratings_pending',requested_concurrency:requestedConcurrency}}),runId=started.run.run_id;
 try{await sql`INSERT INTO batch_run_control(run_id,process_code,worker_pool,desired_state,requested_concurrency) VALUES(${runId}::uuid,${PROCESS},'api','running',${requestedConcurrency})`;await sql`INSERT INTO batch_run_items(batch_run_id,entity_type,entity_id,position,status) SELECT ${runId}::uuid,'title',x.entity_id,(x.ord-1)::int,'queued' FROM unnest(${ids}::text[]) WITH ORDINALITY AS x(entity_id,ord)`;await sql`UPDATE process_runs SET items_total=${ids.length},items_processed=0,items_succeeded=0,items_failed=0,items_pending=${ids.length},updated_at=now() WHERE run_id=${runId}::uuid`;await addProcessEvent(runId,{eventType:'batch_queued',message:'Batch DATA-002 preparado',data:{items_total:ids.length,worker_pool:'api',requested_concurrency:requestedConcurrency,selection:'ratings_pending'}});return{run:await getActiveBatch(PROCESS,sql),reused:false,empty:false,eligibleCount:ids.length}}catch(error){await finishProcessRun(runId,{technicalStatus:'failed',message:'No se pudo preparar DATA-002'}).catch(()=>{});if(error?.code==='23505'){const existing=await getActiveBatch(PROCESS,sql);if(existing)return{run:existing,reused:true,eligibleCount:Number(existing.items_pending||0)}}throw error}
}
