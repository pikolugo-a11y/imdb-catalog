import 'server-only';
import {db} from './db';
import {startProcessRun,addProcessEvent,finishProcessRun} from './process-runtime';
import {getActiveBatch,getLatestBatch} from './batch-engine.js';

const CONFIG={
  'PROC-NOV-009':{pool:'plex',trigger:'novedades_manual',executor:'railway_batch_plex',entityType:'plex_library',operation:'sync_plex_global'},
  'PROC-NOV-008':{pool:'api',trigger:'plex_sync_continuation',executor:'railway_batch_api',entityType:'plex_candidates',operation:'seed_plex_news'}
};

const contextReviewFrom=value=>{const text=String(value||'').trim();return text||'last_success'};

async function activeContinuation(sql){
  const[row]=await sql`SELECT run_id,process_code,technical_status,requested_at,started_at FROM process_runs WHERE process_code='PROC-NOV-008' AND technical_status IN('queued','running') AND finished_at IS NULL ORDER BY requested_at DESC LIMIT 1`;
  return row||null;
}

export async function getPlexGlobalBatchState(process='PROC-NOV-009'){
  const cfg=CONFIG[process];if(!cfg)throw new Error('Proceso Plex global no soportado');
  const sql=db(),[active,latest]=await Promise.all([getActiveBatch(process,sql),getLatestBatch(process,sql)]);
  return{processCode:process,pool:cfg.pool,active,latest};
}

export async function startPlexGlobalBatch(process='PROC-NOV-009',{reviewFrom=null,triggerSource=null,parentRunId=null}={}){
  const cfg=CONFIG[process];if(!cfg)throw new Error('Proceso Plex global no soportado');
  const sql=db();
  const active=await getActiveBatch(process,sql);
  if(active)return{run:active,reused:true,processCode:process};
  if(process==='PROC-NOV-009'){
    const continuation=await activeContinuation(sql);
    if(continuation)return{run:continuation,reused:true,continuation:true,processCode:continuation.process_code};
  }
  const correlationKey=`${process}:batch:${Date.now()}`,source=triggerSource||cfg.trigger;
  const context={surface:'/novedades',operation:cfg.operation,worker_pool:cfg.pool,requested_concurrency:1,automatic:process==='PROC-NOV-008',...(process==='PROC-NOV-009'?{review_from:contextReviewFrom(reviewFrom)}:{parent_process:'PROC-NOV-009'})};
  const started=await startProcessRun({parentRunId,processCode:process,runKind:'batch',triggerSource:source,executor:cfg.executor,entityType:cfg.entityType,entityId:'global',correlationKey,idempotencyKey:correlationKey,context});
  const runId=started.run.run_id;
  try{
    await sql`INSERT INTO batch_run_control(run_id,process_code,worker_pool,desired_state,requested_concurrency) VALUES(${runId}::uuid,${process},${cfg.pool},'running',1)`;
    await sql`INSERT INTO batch_run_items(batch_run_id,entity_type,entity_id,position,status) VALUES(${runId}::uuid,${cfg.entityType},'global',0,'queued')`;
    await sql`UPDATE process_runs SET items_total=1,items_processed=0,items_succeeded=0,items_failed=0,items_pending=1,updated_at=now() WHERE run_id=${runId}::uuid`;
    await addProcessEvent(runId,{eventType:'batch_queued',message:`${process} preparado para Railway`,data:{items_total:1,worker_pool:cfg.pool,requested_concurrency:1,manual:process==='PROC-NOV-009'}});
    return{run:await getActiveBatch(process,sql),reused:false,processCode:process};
  }catch(error){
    await finishProcessRun(runId,{technicalStatus:'failed',message:`No se pudo preparar ${process}`}).catch(()=>{});
    if(error?.code==='23505'){
      const existing=await getActiveBatch(process,sql);
      if(existing)return{run:existing,reused:true,processCode:process};
    }
    throw error;
  }
}
