import {neon} from '@neondatabase/serverless';

const databaseUrl=process.env.DATABASE_URL;
if(!databaseUrl)throw new Error('Falta DATABASE_URL');
const sql=neon(databaseUrl);
const text=(v,max=1000)=>{const s=String(v??'').trim();return s?s.slice(0,max):null};
const json=v=>v==null?null:JSON.stringify(v);

export async function claimObservedWorkerRun(runId,{processCode,executor='github_actions'}={}){
  const id=String(runId||'').trim();if(!id)throw new Error('run_id obligatorio');
  const [run]=await sql`UPDATE process_runs SET technical_status='running',executor=${executor},started_at=COALESCE(started_at,now()),last_heartbeat_at=now(),updated_at=now() WHERE run_id=${id}::uuid AND process_code=${processCode} AND technical_status='queued' RETURNING *`;
  if(!run){const[existing]=await sql`SELECT * FROM process_runs WHERE run_id=${id}::uuid AND process_code=${processCode} LIMIT 1`;if(!existing)throw new Error('Run no encontrado');if(existing.technical_status==='running')return createWorkerTrace(existing);throw new Error(`Run no reclamable: ${existing.technical_status}`)}
  await addEvent(id,{eventType:'run_started',message:'Worker iniciado',data:{executor}});return createWorkerTrace(run);
}

async function addEvent(runId,{eventType,step=null,entityType=null,entityId=null,message=null,durationMs=null,data=null}={}){await sql`INSERT INTO process_run_events(run_id,event_type,step,entity_type,entity_id,message,duration_ms,data) VALUES(${runId}::uuid,${eventType},${step},${entityType},${entityId},${text(message)},${Number.isFinite(durationMs)?Math.max(0,Math.round(durationMs)):null},${json(data)}::jsonb)`}

function createWorkerTrace(run){const runId=run.run_id;return{
  runId,run,
  event:input=>addEvent(runId,input),
  externalCall:async(count=1)=>{const n=Math.max(0,Number(count)||0);if(n)await sql`UPDATE process_runs SET external_calls=external_calls+${n},updated_at=now() WHERE run_id=${runId}::uuid`},
  heartbeat:async(context=null)=>{await sql`UPDATE process_runs SET last_heartbeat_at=now(),context=COALESCE(context,'{}'::jsonb)||COALESCE(${json(context)}::jsonb,'{}'::jsonb),updated_at=now() WHERE run_id=${runId}::uuid`;await addEvent(runId,{eventType:'heartbeat',message:'Worker activo',data:context})},
  error:async(error,{step='process',source='worker',retryable=false,retryAttempt=0,detail=null}={})=>{const message=text(error?.message||error||'Error desconocido');await sql`INSERT INTO process_run_errors(run_id,process_code,entity_type,entity_id,step,error_code,error_class,message,source,retryable,retry_attempt,detail) VALUES(${runId}::uuid,${run.process_code},${run.entity_type},${run.entity_id},${step},${text(error?.code,160)},${text(error?.name||'Error',160)},${message},${source},${Boolean(retryable)},${Math.max(0,Number(retryAttempt)||0)},${json(detail)}::jsonb)`;await sql`UPDATE process_runs SET error_count=error_count+1,updated_at=now() WHERE run_id=${runId}::uuid`;await addEvent(runId,{eventType:'error',step,message,data:{source,retryable:Boolean(retryable)}})},
  finish:async({technicalStatus='succeeded',functionalResult='no_change',metrics=null,before=null,after=null,message='Ejecución finalizada'}={})=>{const[done]=await sql`UPDATE process_runs SET technical_status=${technicalStatus},functional_result=${functionalResult},finished_at=now(),last_heartbeat_at=now(),duration_ms=GREATEST(0,ROUND(EXTRACT(EPOCH FROM(now()-COALESCE(started_at,requested_at)))*1000)::bigint),metrics=${json(metrics)}::jsonb,before_compact=${json(before)}::jsonb,after_compact=${json(after)}::jsonb,items_total=${metrics?.items_total??null},items_processed=${metrics?.items_processed??null},items_succeeded=${metrics?.items_succeeded??null},items_failed=${metrics?.items_failed??null},items_pending=${metrics?.items_pending??null},updated_at=now() WHERE run_id=${runId}::uuid RETURNING *`;await addEvent(runId,{eventType:'run_finished',message,data:{technical_status:technicalStatus,functional_result:functionalResult}});return done}
}}
