const PROCESS_CODE='PROC-PQ-002';

export async function getActiveTechnicalProcessRun(sql){
  const [run]=await sql`SELECT * FROM process_runs WHERE process_code=${PROCESS_CODE} AND technical_status IN('queued','running') ORDER BY requested_at DESC LIMIT 1`;
  return run||null;
}

export async function addTechnicalProcessEvent(sql,runId,{eventType,step=null,message=null,data=null,entityType='plex_library',entityId='technical_snapshot',durationMs=null}={}){
  if(!runId||!eventType)return null;
  const payload=data==null?null:JSON.stringify(data);
  const [event]=await sql`INSERT INTO process_run_events(run_id,event_type,step,entity_type,entity_id,message,duration_ms,data) VALUES(${runId}::uuid,${eventType},${step},${entityType},${entityId},${message},${Number.isFinite(durationMs)?Math.max(0,Math.round(durationMs)):null},${payload}::jsonb) RETURNING event_id,occurred_at`;
  return event||null;
}

export async function mergeTechnicalProcessContext(sql,runId,patch={}){
  if(!runId)return;
  const payload=JSON.stringify(patch||{});
  await sql`UPDATE process_runs SET context=COALESCE(context,'{}'::jsonb)||${payload}::jsonb,updated_at=now() WHERE run_id=${runId}::uuid AND process_code=${PROCESS_CODE}`;
}

export async function addTechnicalCaptureCounters(sql,runId,{claimed=0,ok=0,failed=0}={}){
  if(!runId)return;
  await sql`UPDATE process_runs SET context=COALESCE(context,'{}'::jsonb)||jsonb_build_object('capture_claimed',COALESCE((context->>'capture_claimed')::int,0)+${Number(claimed)||0},'capture_ok',COALESCE((context->>'capture_ok')::int,0)+${Number(ok)||0},'capture_failed',COALESCE((context->>'capture_failed')::int,0)+${Number(failed)||0}),updated_at=now() WHERE run_id=${runId}::uuid AND process_code=${PROCESS_CODE}`;
}

export async function recordTechnicalProcessError(sql,runId,{error,step='technical_capture',entityType='plex_library',entityId='technical_snapshot',retryable=true,detail=null}={}){
  if(!runId)return null;
  const message=String(error?.message||error||'Error desconocido').slice(0,1000);
  const errorClass=String(error?.name||'Error').slice(0,160);
  const errorCode=error?.code?String(error.code).slice(0,160):null;
  const payload=detail==null?null:JSON.stringify(detail);
  const [row]=await sql`INSERT INTO process_run_errors(run_id,process_code,entity_type,entity_id,step,error_code,error_class,message,source,retryable,retry_attempt,detail) VALUES(${runId}::uuid,${PROCESS_CODE},${entityType},${entityId},${step},${errorCode},${errorClass},${message},'railway',${Boolean(retryable)},0,${payload}::jsonb) RETURNING error_id`;
  await sql`UPDATE process_runs SET error_count=error_count+1,updated_at=now() WHERE run_id=${runId}::uuid`;
  await addTechnicalProcessEvent(sql,runId,{eventType:'error',step,entityType,entityId,message,data:{error_id:row?.error_id||null,error_code:errorCode,retryable:Boolean(retryable)}});
  return row||null;
}

export async function finishTechnicalProcessRun(sql,runId,{technicalStatus='succeeded',functionalResult='no_change',message='Captura técnica finalizada',metrics=null}={}){
  if(!runId)return null;
  const metricsJson=metrics==null?null:JSON.stringify(metrics);
  const [run]=await sql`UPDATE process_runs SET technical_status=${technicalStatus},functional_result=${functionalResult},finished_at=now(),duration_ms=GREATEST(0,ROUND(EXTRACT(EPOCH FROM (now()-COALESCE(started_at,requested_at)))*1000)::bigint),metrics=COALESCE(${metricsJson}::jsonb,metrics),updated_at=now() WHERE run_id=${runId}::uuid AND process_code=${PROCESS_CODE} AND technical_status IN('queued','running') RETURNING *`;
  if(run)await addTechnicalProcessEvent(sql,runId,{eventType:'run_finished',message,data:{technical_status:technicalStatus,functional_result:functionalResult},durationMs:Number(run.duration_ms)||null});
  return run||null;
}

export async function reconcileStoppedTechnicalProcessRun(sql){
  const active=await getActiveTechnicalProcessRun(sql);
  if(!active)return null;
  const [legacy]=await sql`
    SELECT status,phase,scan_total,scan_created,scan_changed,capture_planned,capture_ok,capture_failed,started_at,completed_at
    FROM plex_technical_runs
    WHERE started_at >= ${active.requested_at}::timestamptz - interval '5 minutes'
    ORDER BY started_at DESC
    LIMIT 1
  `;
  if(!legacy||legacy.status!=='completed'||!legacy.completed_at)return null;
  const created=Number(legacy.scan_created||0)||0;
  const changed=Number(legacy.scan_changed||0)||0;
  const captureOk=Number(legacy.capture_ok||0)||0;
  const captureFailed=Number(legacy.capture_failed||0)||0;
  const technicalStatus=captureFailed>0?'partial':'succeeded';
  const functionalResult=captureFailed>0?'pending':(created+changed>0?'updated':'no_change');
  await addTechnicalProcessEvent(sql,String(active.run_id),{
    eventType:'run_reconciled',
    step:'technical_worker',
    message:'Ejecución técnica reconciliada tras finalizar el worker',
    data:{legacy_status:legacy.status,legacy_phase:legacy.phase,scan_total:Number(legacy.scan_total||0)||0,created,changed,capture_ok:captureOk,capture_failed:captureFailed}
  });
  return finishTechnicalProcessRun(sql,String(active.run_id),{
    technicalStatus,
    functionalResult,
    message:'Captura técnica reconciliada como completada',
    metrics:{scan_total:Number(legacy.scan_total||0)||0,created,changed,capture_planned:Number(legacy.capture_planned||0)||0,capture_ok:captureOk,capture_failed:captureFailed,reconciled:true}
  });
}

export {PROCESS_CODE};
