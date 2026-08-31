import 'server-only';
import {db} from './db';
import {PIKOSCORE_V3_VERSION} from './pikoscore-v3-core.mjs';
import {startProcessRun,addProcessEvent,finishProcessRun} from './process-runtime';

const DATA003='PROC-DATA-003';
const ACTIVE_ITEM_STATUSES=['queued','leased','running'];

function freshDaysSql(alias='m'){
  return `CASE WHEN COALESCE(mm.release_date,CASE WHEN ${alias}.year BETWEEN 1801 AND 9999 THEN make_date(${alias}.year,1,1) END)>CURRENT_DATE-INTERVAL '3 months' THEN 14 WHEN COALESCE(mm.release_date,CASE WHEN ${alias}.year BETWEEN 1801 AND 9999 THEN make_date(${alias}.year,1,1) END)>CURRENT_DATE-INTERVAL '1 year' THEN 30 WHEN COALESCE(mm.release_date,CASE WHEN ${alias}.year BETWEEN 1801 AND 9999 THEN make_date(${alias}.year,1,1) END)>CURRENT_DATE-INTERVAL '3 years' THEN 90 WHEN COALESCE(mm.release_date,CASE WHEN ${alias}.year BETWEEN 1801 AND 9999 THEN make_date(${alias}.year,1,1) END)>CURRENT_DATE-INTERVAL '10 years' THEN 180 ELSE 365 END`;
}

export async function selectData003BatchEligibleIds(sql=db()){
  const freshDays=freshDaysSql('m');
  const rows=await sql.query(`
    WITH candidates AS (
      SELECT m.imdb_id,m.final_rating,m.pikoscore_version,m.pikoscore_calculated_at,
             COALESCE(m.source_status #>> '{data_quality_manual_ratings,decision}','') manual_rating_decision,
             ${freshDays} AS fresh_days
      FROM catalog_lifecycle cl
      JOIN movies m USING(imdb_id)
      LEFT JOIN movie_metadata mm USING(imdb_id)
      LEFT JOIN catalog_exclusions ex USING(imdb_id)
      WHERE ex.imdb_id IS NULL AND cl.lifecycle_state='PIKOSCORE_PENDING'
    ), ratings AS (
      SELECT c.imdb_id,c.final_rating,c.pikoscore_version,c.pikoscore_calculated_at,c.manual_rating_decision,
             count(*) FILTER(WHERE tr.status='available' AND COALESCE(tr.normalized_rating,0)>0)::int rating_count,
             count(*) FILTER(WHERE tr.status='available' AND COALESCE(tr.normalized_rating,0)>0 AND tr.fetched_at IS NOT NULL AND LEAST(COALESCE(tr.expires_at,'infinity'::timestamptz),tr.fetched_at+(c.fresh_days||' days')::interval)>now())::int fresh_rating_count,
             max(tr.fetched_at) FILTER(WHERE tr.status='available' AND COALESCE(tr.normalized_rating,0)>0) latest_rating_fetched_at
      FROM candidates c LEFT JOIN title_ratings tr USING(imdb_id)
      GROUP BY c.imdb_id,c.final_rating,c.pikoscore_version,c.pikoscore_calculated_at,c.manual_rating_decision
    )
    SELECT imdb_id FROM ratings
    WHERE manual_rating_decision<>'fixed_five'
      AND fresh_rating_count>=2
      AND rating_count>0 AND fresh_rating_count=rating_count
      AND NOT (final_rating IS NOT NULL AND pikoscore_version=$1 AND pikoscore_calculated_at IS NOT NULL AND (latest_rating_fetched_at IS NULL OR pikoscore_calculated_at>=latest_rating_fetched_at))
    ORDER BY imdb_id`,[PIKOSCORE_V3_VERSION]);
  return rows.map(r=>r.imdb_id);
}

export async function getActiveBatch(processCode=DATA003,sql=db()){
  const rows=await sql.query(`SELECT pr.*,brc.worker_pool,brc.desired_state,brc.pause_reason,brc.requested_concurrency,brc.paused_at,brc.resumed_at,brc.cancel_requested_at,brc.closed_at
    FROM batch_run_control brc JOIN process_runs pr ON pr.run_id=brc.run_id
    WHERE brc.process_code=$1 AND brc.closed_at IS NULL ORDER BY brc.created_at DESC LIMIT 1`,[processCode]);
  return rows[0]||null;
}

export async function getLatestBatch(processCode=DATA003,sql=db()){
  const rows=await sql.query(`SELECT pr.*,brc.worker_pool,brc.desired_state,brc.pause_reason,brc.requested_concurrency,brc.paused_at,brc.resumed_at,brc.cancel_requested_at,brc.closed_at
    FROM batch_run_control brc JOIN process_runs pr ON pr.run_id=brc.run_id
    WHERE brc.process_code=$1 ORDER BY brc.created_at DESC LIMIT 1`,[processCode]);
  return rows[0]||null;
}

export async function getData003BatchPanelState(){
  const sql=db();
  const [ids,active,latest,[engine]]=await Promise.all([
    selectData003BatchEligibleIds(sql),getActiveBatch(DATA003,sql),getLatestBatch(DATA003,sql),sql.query(`SELECT desired_state,pause_reason,changed_at FROM batch_engine_control WHERE singleton_id=1`)
  ]);
  return{eligibleCount:ids.length,active,latest,engine:engine||{desired_state:'running'}};
}

export async function startData003Batch({concurrency=8}={}){
  const sql=db();
  const active=await getActiveBatch(DATA003,sql);if(active)return{run:active,reused:true,eligibleCount:Number(active.items_pending||0)};
  const ids=await selectData003BatchEligibleIds(sql);if(!ids.length)return{run:null,reused:false,empty:true,eligibleCount:0};
  const requestedConcurrency=Math.max(1,Math.min(Number(concurrency)||8,32));
  const correlationKey=`${DATA003}:batch:${Date.now()}`;
  const started=await startProcessRun({processCode:DATA003,runKind:'batch',triggerSource:'calidad_datos_batch',executor:'railway_batch_fast',entityType:'title_set',entityId:'score_ready',correlationKey,idempotencyKey:correlationKey,context:{surface:'/calidad/datos',operation:'batch_calculate_pikoscore_v3',worker_pool:'fast',selection:'score_ready',requested_concurrency:requestedConcurrency}});
  const runId=started.run.run_id;
  try{
    await sql.query(`INSERT INTO batch_run_control(run_id,process_code,worker_pool,desired_state,requested_concurrency) VALUES($1::uuid,$2,'fast','running',$3)`,[runId,DATA003,requestedConcurrency]);
    await sql.query(`INSERT INTO batch_run_items(batch_run_id,entity_type,entity_id,position,status)
      SELECT $1::uuid,'title',x.entity_id,(x.ord-1)::int,'queued'
      FROM unnest($2::text[]) WITH ORDINALITY AS x(entity_id,ord)`,[runId,ids]);
    await sql.query(`UPDATE process_runs SET items_total=$2,items_processed=0,items_succeeded=0,items_failed=0,items_pending=$2,updated_at=now() WHERE run_id=$1::uuid`,[runId,ids.length]);
    await addProcessEvent(runId,{eventType:'batch_queued',message:'Batch DATA-003 preparado',data:{items_total:ids.length,worker_pool:'fast',requested_concurrency:requestedConcurrency,selection:'score_ready'}});
    const run=await getActiveBatch(DATA003,sql);return{run,reused:false,empty:false,eligibleCount:ids.length};
  }catch(error){
    await finishProcessRun(runId,{technicalStatus:'failed',message:'No se pudo preparar la cola Batch'}).catch(()=>{});
    if(error?.code==='23505'){
      const existing=await getActiveBatch(DATA003,sql);if(existing)return{run:existing,reused:true,eligibleCount:Number(existing.items_pending||0)};
    }
    throw error;
  }
}

async function requireActive(runId,sql=db()){
  const rows=await sql.query(`SELECT brc.*,pr.technical_status FROM batch_run_control brc JOIN process_runs pr ON pr.run_id=brc.run_id WHERE brc.run_id=$1::uuid AND brc.closed_at IS NULL`,[runId]);
  if(!rows[0])throw new Error('Batch activo no encontrado');return rows[0];
}
export async function pauseBatch(runId,{reason='manual'}={}){
  const sql=db();await requireActive(runId,sql);
  await sql.query(`UPDATE batch_run_control SET desired_state='paused',pause_reason=$2,paused_at=now(),updated_at=now() WHERE run_id=$1::uuid AND closed_at IS NULL`,[runId,reason]);
  await addProcessEvent(runId,{eventType:'batch_paused',message:'Batch pausado',data:{reason}});return getActiveBatch(DATA003,sql);
}
export async function resumeBatch(runId){
  const sql=db();await requireActive(runId,sql);
  await sql.query(`UPDATE batch_run_control SET desired_state='running',pause_reason=NULL,resumed_at=now(),updated_at=now() WHERE run_id=$1::uuid AND closed_at IS NULL`,[runId]);
  await addProcessEvent(runId,{eventType:'batch_resumed',message:'Batch reanudado'});return getActiveBatch(DATA003,sql);
}
export async function cancelBatch(runId){
  const sql=db();await requireActive(runId,sql);
  await sql.query(`UPDATE batch_run_control SET desired_state='cancel_requested',cancel_requested_at=now(),pause_reason='manual_cancel',updated_at=now() WHERE run_id=$1::uuid AND closed_at IS NULL`,[runId]);
  await sql.query(`UPDATE batch_run_items SET status='cancelled',finished_at=now(),lease_owner=NULL,lease_until=NULL,updated_at=now() WHERE batch_run_id=$1::uuid AND status='queued'`,[runId]);
  await addProcessEvent(runId,{eventType:'batch_cancel_requested',message:'Cancelación solicitada'});
  const counts=(await sql.query(`SELECT count(*)::int total,count(*) FILTER(WHERE status IN('running','leased'))::int active,count(*) FILTER(WHERE status='cancelled')::int cancelled FROM batch_run_items WHERE batch_run_id=$1::uuid`,[runId]))[0];
  if(Number(counts?.active||0)===0){
    await sql.query(`UPDATE batch_run_control SET closed_at=now(),updated_at=now() WHERE run_id=$1::uuid`,[runId]);
    await finishProcessRun(runId,{technicalStatus:'cancelled',metrics:{items_total:Number(counts?.total||0),items_cancelled:Number(counts?.cancelled||0)},message:'Batch cancelado'});
  }
  return getLatestBatch(DATA003,sql);
}

export async function pauseAllGenericBatches({reason='manual_global'}={}){
  const sql=db();await sql.query(`UPDATE batch_engine_control SET desired_state='paused',pause_reason=$1,changed_by='centro_operaciones',changed_at=now(),updated_at=now() WHERE singleton_id=1`,[reason]);return true;
}
export async function resumeAllGenericBatches(){
  const sql=db();await sql.query(`UPDATE batch_engine_control SET desired_state='running',pause_reason=NULL,changed_by='centro_operaciones',changed_at=now(),updated_at=now() WHERE singleton_id=1`);return true;
}
