import 'server-only';
import {db} from './db';
import {startProcessRun,addProcessEvent,finishProcessRun} from './process-runtime';

export async function startLifecycleContinuation(imdbId,{origin='novedades',parentRunId=null}={}){
  const sql=db(),active=await sql`SELECT pr.run_id FROM process_runs pr JOIN batch_run_items bi ON bi.batch_run_id=pr.run_id WHERE pr.process_code='PROC-LC-001' AND bi.entity_id=${imdbId} AND bi.status IN('queued','leased','running') ORDER BY pr.requested_at DESC LIMIT 1`;
  if(active[0])return{runId:active[0].run_id,reused:true};
  const cycle=parentRunId||`standalone:${Date.now()}`,key=`PROC-LC-001:${imdbId}:${cycle}`;
  const started=await startProcessRun({parentRunId,processCode:'PROC-LC-001',runKind:'batch',triggerSource:'catalog_admission',executor:'railway_batch_api',entityType:'title',entityId:imdbId,correlationKey:key,idempotencyKey:key,context:{surface:'/novedades',operation:'lifecycle_continuation',origin,worker_pool:'api',admission_run_id:parentRunId}}),runId=started.run.run_id;
  if(started.reused)return{runId,reused:true};
  try{
    await sql`INSERT INTO batch_run_control(run_id,process_code,worker_pool,desired_state,requested_concurrency) VALUES(${runId}::uuid,'PROC-LC-001','api','running',1)`;
    await sql`INSERT INTO batch_run_items(batch_run_id,entity_type,entity_id,position,status) VALUES(${runId}::uuid,'title',${imdbId},0,'queued')`;
    await sql`UPDATE process_runs SET items_total=1,items_pending=1,updated_at=now() WHERE run_id=${runId}::uuid`;
    await addProcessEvent(runId,{eventType:'continuation_queued',entityType:'title',entityId:imdbId,message:'Lifecycle Continuation enviado a Railway',data:{origin,worker_pool:'api',admission_run_id:parentRunId}});
    return{runId,reused:false};
  }catch(error){await finishProcessRun(runId,{technicalStatus:'failed',message:'No se pudo encolar Lifecycle Continuation'}).catch(()=>{});throw error}
}
