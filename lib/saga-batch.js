import 'server-only';
import {db} from './db';
import {startProcessRun,addProcessEvent,finishProcessRun} from './process-runtime';
import {getActiveBatch,pauseBatch,resumeBatch,cancelBatch} from './batch-engine';

const SAGA='PROC-SAGA-001';

export async function selectSagaBatchCollectionIds(sql=db()){
  const rows=await sql`
    SELECT x.tmdb_collection_id::text AS entity_id
    FROM (
      SELECT DISTINCT mc.tmdb_collection_id
      FROM movie_collections mc
      LEFT JOIN catalog_exclusions ex ON ex.imdb_id=mc.imdb_id
      WHERE ex.imdb_id IS NULL AND mc.tmdb_collection_id IS NOT NULL
      UNION
      SELECT sc.tmdb_collection_id FROM saga_collections sc
    ) x
    ORDER BY x.tmdb_collection_id`;
  return rows.map(r=>String(r.entity_id));
}

export async function getSagaFullRefreshState(sql=db()){
  const active=await getActiveBatch(SAGA,sql);
  const [engine]=await sql.query(`SELECT desired_state,pause_reason,changed_at FROM batch_engine_control WHERE singleton_id=1`);
  if(!active)return{active:null,engine:engine||{desired_state:'running'},counts:null};
  const [counts]=await sql.query(`SELECT
    count(*)::int total,
    count(*) FILTER(WHERE status='queued')::int queued,
    count(*) FILTER(WHERE status IN('leased','running'))::int active,
    count(*) FILTER(WHERE status='succeeded')::int succeeded,
    count(*) FILTER(WHERE status='failed')::int failed,
    count(*) FILTER(WHERE status='cancelled')::int cancelled
    FROM batch_run_items WHERE batch_run_id=$1::uuid`,[active.run_id]);
  return{active,engine:engine||{desired_state:'running'},counts:counts||{total:0,queued:0,active:0,succeeded:0,failed:0,cancelled:0}};
}

async function requireSagaRun(runId,sql=db()){
  const rows=await sql.query(`SELECT brc.run_id,brc.process_code,brc.closed_at FROM batch_run_control brc WHERE brc.run_id=$1::uuid LIMIT 1`,[runId]);
  const row=rows[0];
  if(!row||row.closed_at||row.process_code!==SAGA)throw new Error('Batch activo de Sagas no encontrado');
  return row;
}

export async function pauseSagaFullRefresh(runId){const sql=db();await requireSagaRun(runId,sql);return pauseBatch(runId,{reason:'manual_sagas'});}
export async function resumeSagaFullRefresh(runId){const sql=db();await requireSagaRun(runId,sql);return resumeBatch(runId);}
export async function cancelSagaFullRefresh(runId){const sql=db();await requireSagaRun(runId,sql);return cancelBatch(runId);}

export async function startSagaFullRefreshBatch({concurrency=3}={}){
  const sql=db();
  const active=await getActiveBatch(SAGA,sql);
  if(active)return{run:active,reused:true,queued:Number(active.items_pending||0),total:Number(active.items_total||0)};
  const ids=await selectSagaBatchCollectionIds(sql);
  if(!ids.length)return{run:null,reused:false,empty:true,queued:0,total:0};
  const requestedConcurrency=Math.max(1,Math.min(Number(concurrency)||3,8));
  const correlationKey=`${SAGA}:full:${Date.now()}`;
  const started=await startProcessRun({processCode:SAGA,runKind:'batch',triggerSource:'sagas_manual_full',executor:'railway_batch_api',entityType:'saga_collection_set',entityId:'all',correlationKey,idempotencyKey:correlationKey,context:{surface:'/sagas',operation:'refresh_all_sagas_tmdb',worker_pool:'api',selection:'all_collections',requested_concurrency:requestedConcurrency}});
  const runId=started.run.run_id;
  try{
    await sql.query(`INSERT INTO batch_run_control(run_id,process_code,worker_pool,desired_state,requested_concurrency) VALUES($1::uuid,$2,'api','running',$3)`,[runId,SAGA,requestedConcurrency]);
    await sql.query(`INSERT INTO batch_run_items(batch_run_id,entity_type,entity_id,position,status)
      SELECT $1::uuid,'saga_collection',x.entity_id,(x.ord-1)::int,'queued'
      FROM unnest($2::text[]) WITH ORDINALITY AS x(entity_id,ord)`,[runId,ids]);
    await sql.query(`UPDATE process_runs SET items_total=$2,items_processed=0,items_succeeded=0,items_failed=0,items_pending=$2,updated_at=now() WHERE run_id=$1::uuid`,[runId,ids.length]);
    await addProcessEvent(runId,{eventType:'batch_queued',message:'Actualización completa de sagas preparada',data:{items_total:ids.length,worker_pool:'api',requested_concurrency:requestedConcurrency,selection:'all_collections'}});
    return{run:await getActiveBatch(SAGA,sql),reused:false,empty:false,queued:ids.length,total:ids.length};
  }catch(error){
    await finishProcessRun(runId,{technicalStatus:'failed',message:'No se pudo preparar la actualización completa de sagas'}).catch(()=>{});
    if(error?.code==='23505'){
      const existing=await getActiveBatch(SAGA,sql);
      if(existing)return{run:existing,reused:true,queued:Number(existing.items_pending||0),total:Number(existing.items_total||0)};
    }
    throw error;
  }
}
