export async function ensureTechnicalControl(sql){
  await sql`INSERT INTO plex_technical_control(id,armed,requested_state,actual_state) VALUES(1,false,'stopped','stopped') ON CONFLICT(id) DO NOTHING`;
}

export async function getTechnicalControl(sql){
  await ensureTechnicalControl(sql);
  const [row]=await sql`SELECT * FROM plex_technical_control WHERE id=1`;
  return row;
}

export async function setTechnicalRequestedState(sql,state){
  if(!['running','paused','stopped'].includes(state))throw new Error(`Estado técnico no soportado: ${state}`);
  await ensureTechnicalControl(sql);
  const current=await getTechnicalControl(sql);
  if(state==='running'&&!current.armed)throw new Error('La captura técnica todavía no está autorizada para arrancar');
  const [row]=await sql`
    UPDATE plex_technical_control SET
      requested_state=${state},
      paused_at=CASE WHEN ${state}='paused' THEN now() ELSE paused_at END,
      stopped_at=CASE WHEN ${state}='stopped' THEN now() ELSE stopped_at END,
      last_error=CASE WHEN ${state}='running' THEN NULL ELSE last_error END,
      updated_at=now()
    WHERE id=1 RETURNING *
  `;
  return row;
}

export async function setTechnicalArmed(sql,armed){
  await ensureTechnicalControl(sql);
  const [row]=await sql`
    UPDATE plex_technical_control SET
      armed=${Boolean(armed)},
      requested_state=CASE WHEN ${Boolean(armed)} THEN requested_state ELSE 'stopped' END,
      actual_state=CASE WHEN ${Boolean(armed)} THEN actual_state ELSE 'stopped' END,
      updated_at=now()
    WHERE id=1 RETURNING *
  `;
  return row;
}

export async function heartbeatTechnicalWorker(sql,{workerId,actualState,lastError=null,lastBatchOk=0,lastBatchFailed=0,lastBatchMs=null}={}){
  await ensureTechnicalControl(sql);
  const [row]=await sql`
    UPDATE plex_technical_control SET
      actual_state=${actualState},worker_id=${workerId||null},heartbeat_at=now(),
      started_at=CASE WHEN ${actualState}='running' AND started_at IS NULL THEN now() ELSE started_at END,
      completed_at=CASE WHEN ${actualState}='completed' THEN now() ELSE completed_at END,
      last_error=${lastError},last_batch_ok=${Number(lastBatchOk)||0},last_batch_failed=${Number(lastBatchFailed)||0},
      last_batch_ms=${lastBatchMs==null?null:Number(lastBatchMs)},updated_at=now()
    WHERE id=1 RETURNING *
  `;
  return row;
}

export async function getTechnicalDashboard(sql){
  await ensureTechnicalControl(sql);
  const [control,counts,recent]=await Promise.all([
    getTechnicalControl(sql),
    sql`
      SELECT p.item_type,s.snapshot_status,count(*)::int AS count
      FROM plex_technical_state s JOIN plex_items p USING(rating_key)
      WHERE p.active=true AND p.item_type IN ('movie','episode')
      GROUP BY p.item_type,s.snapshot_status
    `,
    sql`
      SELECT
        count(*) FILTER (WHERE captured_at>=now()-interval '5 minutes')::int AS ready_5m,
        count(*) FILTER (WHERE captured_at>=now()-interval '15 minutes')::int AS ready_15m,
        max(captured_at) AS last_capture_at
      FROM plex_technical_state
      WHERE snapshot_status='ready'
    `
  ]);
  const blank=()=>({total:0,ready:0,pending:0,stale:0,error:0,missing:0});
  const byType={movie:blank(),episode:blank()};
  for(const row of counts){
    const t=byType[row.item_type]||blank();
    const key=String(row.snapshot_status||'missing');
    t.total+=Number(row.count)||0;
    if(key in t)t[key]+=Number(row.count)||0;
    byType[row.item_type]=t;
  }
  const total=blank();
  for(const t of Object.values(byType))for(const k of Object.keys(total))total[k]+=t[k]||0;
  const r=recent[0]||{};
  const perMinute5=Math.round(((Number(r.ready_5m)||0)/5)*10)/10;
  const perMinute15=Math.round(((Number(r.ready_15m)||0)/15)*10)/10;
  const heartbeatAgeMs=control?.heartbeat_at?Date.now()-new Date(control.heartbeat_at).getTime():null;
  return{control,byType,total,velocity:{perMinute5,perMinute15,lastCaptureAt:r.last_capture_at||null},workerOnline:heartbeatAgeMs!=null&&heartbeatAgeMs<90000};
}
