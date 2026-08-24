import Link from 'next/link';
import Kpi from '@/components/Kpi';
import {BATCH_STAGES,getBatchControlOverview,getBatchPreview,getJobDetail} from '@/lib/batch-control';
import {createBatchRunAction,previewBatchRunAction,pauseBatchAction,resumeBatchAction,pauseRunAction,resumeRunAction,cancelRunAction,updateSourceLimitAction,retryEntityAction,setManualReviewAction} from './actions';
import AutoRefresh from './AutoRefresh';

export const dynamic='force-dynamic';
const dt=v=>v?new Date(v).toLocaleString('es-ES'):'—';
const dur=(a,b)=>a&&b?`${Math.max(0,Math.round((new Date(b)-new Date(a))/1000))} s`:'—';
const label=s=>({IDENTITY_PENDING:'Identidad',IDENTITY_VALIDATION:'Validación identidad',DATA_INCOMPLETE:'Datos principales',PIKOSCORE_PENDING:'PikoScore',MOVIE_FILE_PENDING:'Archivo película',SERIES_SYNC_PENDING:'Series',TECH_PENDING:'PikoQuality'}[s]||s);
const retryLabel=s=>({new_only:'Solo nuevos',new_and_technical:'Nuevos + errores técnicos',include_unresolved:'Incluir no resueltos',all:'Forzar todos'}[s]||s);
const outcomeClass=o=>o==='CORREGIDO'?'ok':o==='ERROR'||o==='REVISION_MANUAL'?'bad':['NO_ENCONTRADO','INCOMPLETO','SIN_CAMBIOS','ACTUALIZADO_SIN_AVANCE'].includes(o)?'warn':'';
const titleOf=j=>j.title_es||j.title||j.original_title||j.entity_id;
const pretty=v=>{if(v===null||v===undefined)return'—';if(typeof v==='string')return v;try{return JSON.stringify(v,null,2)}catch{return String(v)}};

export default async function BatchAdmin({searchParams}){
  const sp=await searchParams||{},stage=BATCH_STAGES.includes(sp.stage)?sp.stage:'IDENTITY_PENDING';
  const retry=['new_only','new_and_technical','include_unresolved','all'].includes(sp.retry)?sp.retry:'new_only';
  const limit=Math.max(1,Math.min(5000,Number(sp.limit||25)));
  const jobId=sp.job?Number(sp.job):null;
  const [d,preview,detail]=await Promise.all([getBatchControlOverview(),getBatchPreview({stage,retryMode:retry,limit}),jobId?getJobDetail(jobId):Promise.resolve(null)]);
  const paused=Boolean(d.control?.paused),active=d.activeRun,hasLive=Boolean(active&&['queued','running'].includes(active.status));
  const activeProgress=active?`${active.done+active.failed+active.review+active.cancelled+active.skipped}/${active.jobs}`:'—';

  return <>
    <AutoRefresh active={hasLive}/>
    <div className="page-head batch-head"><div><div className="eyebrow">Lifecycle Control Center</div><h1>Batch / Autopilot</h1><p>Controla, ejecuta y audita Lifecycle desde una sola pantalla. Cada resultado debe poder explicarse desde aquí.</p></div><Link href="/admin">← Administración</Link></div>

    <div className="batch-statusbar">
      <div><span>Motor</span><strong className={paused?'status warn':'status ok'}>{paused?'PAUSADO':'ACTIVO'}</strong></div>
      <div><span>Run activo</span><strong>{active?`#${active.id} · ${label(active.target_stage)}`:'Ninguno'}</strong></div>
      <div><span>Progreso</span><strong>{activeProgress}</strong></div>
      <div><span>Cola</span><strong>{d.summary.queued} pendientes · {d.summary.active} activos</strong></div>
      <div className="batch-status-actions">{paused?<form action={resumeBatchAction}><button>Reanudar motor</button></form>:<form action={pauseBatchAction}><input type="hidden" name="reason" value="Pausado desde Lifecycle Control Center"/><button className="danger">Pausar motor</button></form>}</div>
    </div>

    <div className="mini-kpis"><Kpi label="Runs" value={d.summary.runs}/><Kpi label="Jobs" value={d.summary.jobs}/><Kpi label="En cola" value={d.summary.queued}/><Kpi label="Activos" value={d.summary.active}/><Kpi label="Retry" value={d.summary.retry}/><Kpi label="Revisión" value={d.summary.review}/><Kpi label="Fallidos" value={d.summary.failed}/></div>

    {active&&<section className="section batch-active"><div className="section-head"><div><h2>Run activo #{active.id}</h2><p>{label(active.target_stage)} · {retryLabel(active.limits?.retry_mode)} · iniciado {dt(active.started_at||active.created_at)}</p></div><strong>{activeProgress}</strong></div>
      <div className="batch-outcomes"><span className="status ok">Corregido {active.corrected}</span><span>Actualizado sin avance {active.updated_no_advance}</span><span className="status warn">Sin cambios {active.no_change}</span><span className="status warn">No encontrado {active.not_found}</span><span className="status warn">Incompleto {active.incomplete}</span><span className="status bad">Revisión {active.manual_review}</span><span className="status bad">Error {active.functional_error}</span></div>
      <div className="quick-actions">{active.status==='running'||active.status==='queued'?<form action={pauseRunAction}><input type="hidden" name="runId" value={active.id}/><button>Pausar run</button></form>:null}{active.status==='paused'?<form action={resumeRunAction}><input type="hidden" name="runId" value={active.id}/><button>Reanudar run</button></form>:null}<form action={cancelRunAction}><input type="hidden" name="runId" value={active.id}/><button className="ghost danger-soft">Cancelar run</button></form></div>
    </section>}

    <section className="section" id="launch"><div className="section-head"><div><h2>Lanzar lote</h2><p>Primero previsualiza quién entrará. La política anti-bucle decide qué títulos son elegibles.</p></div></div>
      <form action={previewBatchRunAction} className="batch-launch-form">
        <label><span>Etapa</span><select name="stage" defaultValue={stage}>{BATCH_STAGES.map(s=><option key={s} value={s}>{label(s)}</option>)}</select></label>
        <label><span>Tamaño</span><select name="limit" defaultValue={String(limit)}><option value="1">1</option><option value="5">5</option><option value="25">25</option><option value="100">100</option><option value="500">500</option></select></label>
        <label><span>Política</span><select name="retryMode" defaultValue={retry}><option value="new_only">Solo nuevos</option><option value="new_and_technical">Nuevos + errores técnicos</option><option value="include_unresolved">Incluir no resueltos</option><option value="all">Forzar todos</option></select></label>
        <button>Previsualizar</button>
      </form>

      <div className="batch-preview">
        <div className="batch-preview-main"><span>Entrarán en este run</span><strong>{Math.min(preview.eligible,limit)}</strong><small>de {preview.eligible} elegibles · {preview.counts.total} en la etapa</small></div>
        <div className="batch-preview-grid"><span><b>{preview.counts.new}</b>Nuevos</span><span><b>{preview.counts.context_changed}</b>Contexto cambiado</span><span><b>{preview.counts.technical_due}</b>Error recuperable</span><span><b>{preview.counts.unresolved}</b>No resueltos</span><span><b>{preview.counts.cooldown}</b>En cooldown</span><span><b>{preview.counts.manual_review}</b>Revisión manual</span></div>
      </div>
      {retry==='all'&&<div className="alert">⚠️ <b>Forzar todos</b> ignora el anti-bucle para esta selección. Úsalo solo cuando quieras repetir conscientemente consultas ya realizadas.</div>}
      <div className="table-wrap batch-preview-table"><table><thead><tr><th>Título</th><th>IMDb</th><th>Tipo</th><th>Último resultado</th><th>Intentos</th></tr></thead><tbody>{preview.selected.slice(0,25).map(x=><tr key={x.imdb_id}><td><b>{x.title}</b><span className="sub">{x.year||'—'}</span></td><td>{x.imdb_id}</td><td>{x.type||'—'}</td><td>{x.last_outcome?<span className={`status ${outcomeClass(x.last_outcome)}`}>{x.last_outcome}</span>:'Nunca intentado'}</td><td>{x.attempt_count}</td></tr>)}</tbody></table></div>
      <form action={createBatchRunAction} className="batch-create-run"><input type="hidden" name="stage" value={stage}/><input type="hidden" name="limit" value={limit}/><input type="hidden" name="retryMode" value={retry}/><button disabled={!preview.eligible}>Crear run de {Math.min(preview.eligible,limit)} · {retryLabel(retry)}</button><span>{paused?'El motor está pausado: el run quedará preparado hasta que lo reanudes.':'El motor está activo: el worker podrá capturarlo inmediatamente.'}</span></form>
    </section>

    {detail&&<section className="section batch-job-detail"><div className="section-head"><div><h2>{titleOf(detail.job)}</h2><p>Job #{detail.job.id} · Run #{detail.job.run_id} · {detail.job.entity_id} · {label(detail.job.stage)}</p></div><Link href="/admin/batch">Cerrar detalle</Link></div>
      <div className="batch-job-summary"><div><span>Resultado</span><strong className={`status ${outcomeClass(detail.job.functional_outcome)}`}>{detail.job.functional_outcome||detail.job.status}</strong></div><div><span>Lifecycle</span><strong>{detail.job.lifecycle_before||'—'} → {detail.job.lifecycle_after||'—'}</strong></div><div><span>Intentos</span><strong>{detail.job.attempt_count||detail.job.attempt||0}</strong></div><div><span>Sin progreso</span><strong>{detail.job.no_progress_count||0}</strong></div><div><span>Próximo retry</span><strong>{dt(detail.job.next_retry_at)}</strong></div><div><span>Duración</span><strong>{dur(detail.job.started_at,detail.job.finished_at)}</strong></div></div>
      {detail.job.blocking_reason&&<div className="alert"><b>Bloqueo Lifecycle:</b> {detail.job.blocking_reason}</div>}
      <h3 className="batch-subtitle">Timeline de ejecución</h3>
      <div className="process-list">{detail.steps.length?detail.steps.map(s=><details className={`process-card process-${s.status}`} key={s.id}><summary><div><b>{s.step_order}. {s.step_key}</b><span>{s.source||'interno'} · {s.status} · {s.duration_ms??0} ms</span></div><div className="process-stats"><span>{s.attempted?'intentado':'omitido'}</span><span>{s.found===true?'encontrado':s.found===false?'no encontrado':'—'}</span><span>{s.changed?'cambió':'sin cambio'}</span></div></summary><div className="process-detail">{s.reason&&<p><b>Motivo:</b> {s.reason}</p>}{s.error_message&&<div className="alert"><b>{s.error_class||'Error'}:</b> {s.error_message}</div>}<div className="batch-json-grid"><div><b>Antes</b><pre>{pretty(s.before_value)}</pre></div><div><b>Después</b><pre>{pretty(s.after_value)}</pre></div><div><b>Resultado</b><pre>{pretty(s.result)}</pre></div></div></div></details>):<p className="muted">Este job no tiene steps registrados.</p>}</div>
      <div className="batch-control-row">
        <form action={retryEntityAction}><input type="hidden" name="stage" value={detail.job.stage}/><input type="hidden" name="entityId" value={detail.job.entity_id}/><button>Reintentar ahora</button></form>
        {detail.job.manual_review?<form action={setManualReviewAction}><input type="hidden" name="stage" value={detail.job.stage}/><input type="hidden" name="entityId" value={detail.job.entity_id}/><input type="hidden" name="enabled" value="false"/><button>Quitar revisión manual</button></form>:<form action={setManualReviewAction}><input type="hidden" name="stage" value={detail.job.stage}/><input type="hidden" name="entityId" value={detail.job.entity_id}/><input type="hidden" name="enabled" value="true"/><input name="reason" placeholder="Motivo opcional"/><button className="danger">Enviar a revisión manual</button></form>}
      </div>
      <h3 className="batch-subtitle">Historial de este título en esta etapa</h3><div className="table-wrap"><table><thead><tr><th>Job</th><th>Run</th><th>Fecha</th><th>Resultado</th><th>Lifecycle</th><th>Error</th></tr></thead><tbody>{detail.history.map(h=><tr key={h.id}><td><Link className="title" href={`/admin/batch?job=${h.id}`}>#{h.id}</Link></td><td>#{h.run_id}</td><td>{dt(h.created_at)}</td><td><span className={`status ${outcomeClass(h.functional_outcome)}`}>{h.functional_outcome||h.status}</span></td><td>{h.lifecycle_before||'—'} → {h.lifecycle_after||'—'}</td><td>{h.error_message||'—'}</td></tr>)}</tbody></table></div>
    </section>}

    <section className="section"><div className="section-head"><div><h2>Últimos jobs</h2><p>Una fila por título. Pulsa en el job para ver steps, cambios, errores e historial.</p></div></div><div className="table-wrap"><table><thead><tr><th>Job</th><th>Título</th><th>Etapa</th><th>Estado</th><th>Resultado</th><th>Lifecycle</th><th>Intentos</th><th>Retry</th></tr></thead><tbody>{d.jobs.map(j=><tr key={j.id}><td><Link className="title" href={`/admin/batch?job=${j.id}`}>#{j.id}</Link></td><td><b>{titleOf(j)}</b><span className="sub">{j.entity_id} · {j.type||'—'} · {j.year||'—'}</span></td><td>{label(j.stage)}</td><td>{j.status}</td><td>{j.functional_outcome?<span className={`status ${outcomeClass(j.functional_outcome)}`}>{j.functional_outcome}</span>:'—'}</td><td>{j.lifecycle_before||'—'} → {j.lifecycle_after||'—'}</td><td>{j.attempt_count||j.attempt||0}<span className="sub">sin progreso {j.no_progress_count||0}</span></td><td>{dt(j.next_retry_at)}</td></tr>)}</tbody></table></div></section>

    <section className="section"><div className="section-head"><div><h2>No resueltos / revisión</h2><p>Los casos bloqueados por revisión manual no desaparecen: quedan visibles y gobernables.</p></div></div>{d.manualReview.length?<div className="table-wrap"><table><thead><tr><th>Título</th><th>Etapa</th><th>Outcome</th><th>Intentos</th><th>Motivo</th><th>Último job</th></tr></thead><tbody>{d.manualReview.map(x=><tr key={`${x.entity_id}-${x.stage}`}><td><b>{x.title_es||x.title||x.entity_id}</b><span className="sub">{x.entity_id}</span></td><td>{label(x.stage)}</td><td>{x.last_outcome||'—'}</td><td>{x.attempt_count}</td><td>{x.manual_review_reason||'—'}</td><td>{x.last_job_id?<Link className="title" href={`/admin/batch?job=${x.last_job_id}`}>#{x.last_job_id}</Link>:'—'}</td></tr>)}</tbody></table></div>:<div className="alert">No hay títulos actualmente en revisión manual.</div>}</section>

    <section className="section"><div className="section-head"><div><h2>Fuentes y límites</h2><p>Consumo de hoy, breaker y configuración. Los límites avanzados siguen editables.</p></div></div><div className="batch-source-grid">{d.limits.map(x=><div className="card batch-source" key={x.source}><div className="batch-source-head"><div><b>{x.source}</b><span className={`status ${x.enabled?'ok':'bad'}`}>{x.enabled?'ACTIVA':'DESACTIVADA'}</span></div><strong>{x.usage?.attempts||0}{x.daily_budget!=null?` / ${x.daily_budget}`:''}</strong></div><p>{x.usage?.failures||0} fallos · latencia media {x.usage?.avg_ms??'—'} ms · breaker {x.breaker_state}</p>{x.blocked_until&&<div className="alert">Bloqueada hasta {dt(x.blocked_until)}</div>}<details><summary>Editar límites</summary><form action={updateSourceLimitAction} className="batch-source-form"><input type="hidden" name="source" value={x.source}/><label><input type="checkbox" name="enabled" defaultChecked={Boolean(x.enabled)}/> Habilitada</label><label>Concurrencia<input name="maxConcurrency" type="number" min="0" max="16" defaultValue={x.max_concurrency}/></label><label>Intervalo ms<input name="minIntervalMs" type="number" min="0" max="600000" defaultValue={x.min_interval_ms}/></label><label>Presupuesto/día<input name="dailyBudget" type="number" min="0" defaultValue={x.daily_budget??''}/></label><button>Guardar</button></form></details></div>)}</div></section>

    <section className="section"><div className="section-head"><div><h2>Historial de runs</h2><p>Compara las pruebas y abre sus jobs desde la tabla superior.</p></div></div><div className="process-list">{d.runs.map(r=><details className={`process-card process-${r.status}`} key={r.id}><summary><div><b>#{r.id} · {label(r.target_stage)}</b><span>{dt(r.created_at)} · {r.status} · {retryLabel(r.limits?.retry_mode)}</span></div><div className="process-stats"><span>{r.jobs} jobs</span><span>{r.corrected} corregidos</span><span>{r.not_found} no encontrados</span><span>{r.functional_error} error</span></div></summary><div className="process-detail"><div className="tech-grid"><span><b>Queued</b>{r.queued}</span><span><b>Activos</b>{r.active}</span><span><b>Done</b>{r.done}</span><span><b>Review</b>{r.review}</span><span><b>Inicio</b>{dt(r.started_at)}</span><span><b>Fin</b>{dt(r.finished_at)}</span></div>{r.stop_reason&&<p>{r.stop_reason}</p>}</div></details>)}</div></section>
  </>;
}
