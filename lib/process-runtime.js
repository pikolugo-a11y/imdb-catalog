import 'server-only';
import {db} from './db';

const TECHNICAL_STATUSES=new Set(['queued','running','succeeded','failed','partial','cancelled']);
const FUNCTIONAL_RESULTS=new Set(['updated','no_change','pending','blocked','not_found','invalid']);
const RUN_KINDS=new Set(['individual','batch','system']);

function cleanText(value,max=200){const text=String(value??'').trim();return text?text.slice(0,max):null}
function compactJson(value){if(value===undefined||value===null)return null;return JSON.stringify(value)}
function errorShape(error){return{message:cleanText(error?.message||error||'Error desconocido',1000)||'Error desconocido',errorClass:cleanText(error?.name||'Error',160),errorCode:cleanText(error?.code,160)}}

export async function startProcessRun(input={}){
  const sql=db();
  const processCode=cleanText(input.processCode,120);
  if(!processCode)throw new Error('processCode es obligatorio');
  const runKind=RUN_KINDS.has(input.runKind)?input.runKind:'individual';
  const triggerSource=cleanText(input.triggerSource,120)||'manual';
  const executor=cleanText(input.executor,120)||'vercel';
  const entityType=cleanText(input.entityType,80);
  const entityId=cleanText(input.entityId,200);
  const correlationKey=cleanText(input.correlationKey,240);
  const idempotencyKey=cleanText(input.idempotencyKey,240);
  const context=compactJson(input.context);
  const parentRunId=cleanText(input.parentRunId,80);
  try{
    const [run]=await sql`INSERT INTO process_runs(parent_run_id,process_code,run_kind,trigger_source,executor,technical_status,entity_type,entity_id,correlation_key,idempotency_key,requested_at,started_at,context,created_at,updated_at) VALUES(${parentRunId}::uuid,${processCode},${runKind},${triggerSource},${executor},'running',${entityType},${entityId},${correlationKey},${idempotencyKey},now(),now(),${context}::jsonb,now(),now()) RETURNING *`;
    await addProcessEvent(run.run_id,{eventType:'run_started',entityType,entityId,message:'Ejecución iniciada',data:{trigger_source:triggerSource,executor}});
    return{run,reused:false};
  }catch(error){
    if(error?.code==='23505'&&idempotencyKey){
      const [run]=await sql`SELECT * FROM process_runs WHERE process_code=${processCode} AND idempotency_key=${idempotencyKey} ORDER BY requested_at DESC LIMIT 1`;
      if(run)return{run,reused:true};
    }
    throw error;
  }
}

export async function addProcessEvent(runId,input={}){
  const sql=db();
  const eventType=cleanText(input.eventType,120);
  if(!eventType)throw new Error('eventType es obligatorio');
  const data=compactJson(input.data);
  const [event]=await sql`INSERT INTO process_run_events(run_id,event_type,step,entity_type,entity_id,message,duration_ms,data) VALUES(${runId}::uuid,${eventType},${cleanText(input.step,160)},${cleanText(input.entityType,80)},${cleanText(input.entityId,200)},${cleanText(input.message,1000)},${Number.isFinite(input.durationMs)?Math.max(0,Math.round(input.durationMs)):null},${data}::jsonb) RETURNING event_id,occurred_at`;
  return event;
}

export async function recordProcessError(runId,input={}){
  const sql=db();
  const shaped=errorShape(input.error);
  const detail=compactJson(input.detail);
  const [row]=await sql`SELECT process_code,entity_type,entity_id FROM process_runs WHERE run_id=${runId}::uuid LIMIT 1`;
  if(!row)throw new Error('Run no encontrado');
  const [record]=await sql`INSERT INTO process_run_errors(run_id,process_code,entity_type,entity_id,step,error_code,error_class,message,source,retryable,retry_attempt,detail) VALUES(${runId}::uuid,${row.process_code},${cleanText(input.entityType,80)||row.entity_type},${cleanText(input.entityId,200)||row.entity_id},${cleanText(input.step,160)},${cleanText(input.errorCode,160)||shaped.errorCode},${cleanText(input.errorClass,160)||shaped.errorClass},${cleanText(input.message,1000)||shaped.message},${cleanText(input.source,160)},${Boolean(input.retryable)},${Math.max(0,Number(input.retryAttempt)||0)},${detail}::jsonb) RETURNING error_id,occurred_at`;
  await sql`UPDATE process_runs SET error_count=error_count+1,updated_at=now() WHERE run_id=${runId}::uuid`;
  await addProcessEvent(runId,{eventType:'error',step:input.step,entityType:input.entityType||row.entity_type,entityId:input.entityId||row.entity_id,message:cleanText(input.message,1000)||shaped.message,data:{error_id:record.error_id,error_code:cleanText(input.errorCode,160)||shaped.errorCode,retryable:Boolean(input.retryable)}});
  return record;
}

export async function incrementExternalCalls(runId,count=1){const sql=db();const n=Math.max(0,Number(count)||0);if(!n)return;await sql`UPDATE process_runs SET external_calls=external_calls+${n},updated_at=now() WHERE run_id=${runId}::uuid`}

export async function finishProcessRun(runId,input={}){
  const sql=db();
  const technicalStatus=TECHNICAL_STATUSES.has(input.technicalStatus)?input.technicalStatus:'succeeded';
  const functionalResult=input.functionalResult&&FUNCTIONAL_RESULTS.has(input.functionalResult)?input.functionalResult:null;
  const metrics=compactJson(input.metrics);
  const context=compactJson(input.context);
  const beforeCompact=compactJson(input.before);
  const afterCompact=compactJson(input.after);
  const [run]=await sql`UPDATE process_runs SET technical_status=${technicalStatus},functional_result=${functionalResult},finished_at=now(),duration_ms=GREATEST(0,ROUND(EXTRACT(EPOCH FROM (now()-COALESCE(started_at,requested_at)))*1000)::bigint),metrics=COALESCE(${metrics}::jsonb,metrics),context=COALESCE(context,'{}'::jsonb)||COALESCE(${context}::jsonb,'{}'::jsonb),before_compact=COALESCE(${beforeCompact}::jsonb,before_compact),after_compact=COALESCE(${afterCompact}::jsonb,after_compact),updated_at=now() WHERE run_id=${runId}::uuid RETURNING *`;
  if(!run)throw new Error('Run no encontrado');
  await addProcessEvent(runId,{eventType:'run_finished',entityType:run.entity_type,entityId:run.entity_id,message:input.message||'Ejecución finalizada',durationMs:Number(run.duration_ms)||null,data:{technical_status:technicalStatus,functional_result:functionalResult}});
  return run;
}

export async function executeObservedProcess(input,operation){
  const started=await startProcessRun(input);
  const runId=started.run.run_id;
  if(started.reused)return{runId,reused:true,result:null,run:started.run};
  try{
    const result=await operation({runId,event:(event)=>addProcessEvent(runId,{entityType:input.entityType,entityId:input.entityId,...event}),externalCall:(count=1)=>incrementExternalCalls(runId,count)});
    const run=await finishProcessRun(runId,{technicalStatus:result?.technicalStatus||'succeeded',functionalResult:result?.functionalResult||'no_change',metrics:result?.metrics,context:result?.context,before:result?.before,after:result?.after,message:result?.message});
    return{runId,reused:false,result,run};
  }catch(error){
    await recordProcessError(runId,{error,step:error?.processStep||'process',source:error?.source||input.executor||'vercel',retryable:Boolean(error?.retryable),detail:error?.detail}).catch(()=>{});
    await finishProcessRun(runId,{technicalStatus:'failed',functionalResult:null,message:'Ejecución fallida'}).catch(()=>{});
    error.runId=runId;
    throw error;
  }
}
