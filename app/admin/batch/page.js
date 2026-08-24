import Link from 'next/link';
import {BATCH_STAGES,getBatchControlOverview,getBatchPreview} from '@/lib/batch-control';
import {createBatchRunAction,previewBatchRunAction,pauseBatchAction,resumeBatchAction,pauseRunAction,resumeRunAction,cancelRunAction,updateSourceLimitAction} from './actions';
import AutoRefresh from './AutoRefresh';

export const dynamic='force-dynamic';
const dt=v=>v?new Date(v).toLocaleString('es-ES'):'—';
const label=s=>({IDENTITY_PENDING:'Identidad',IDENTITY_VALIDATION:'Validación identidad',DATA_INCOMPLETE:'Datos principales',PIKOSCORE_PENDING:'PikoScore',MOVIE_FILE_PENDING:'Archivo película',SERIES_SYNC_PENDING:'Series',TECH_PENDING:'PikoQuality'}[s]||s);
const retryLabel=s=>({new_only:'Solo nuevos',new_and_technical:'Nuevos + errores técnicos',include_unresolved:'Incluir no resueltos',all:'Forzar todos'}[s]||s);
const outcomeClass=o=>o==='CORREGIDO'?'ok':o==='ERROR'||o==='REVISION_MANUAL'?'bad':['NO_ENCONTRADO','INCOMPLETO','SIN_CAMBIOS','ACTUALIZADO_SIN_AVANCE'].includes(o)?'warn':'';
const titleOf=j=>j.title_es||j.title||j.original_title||j.entity_id;

export default async function BatchAdmin({searchParams}){
  const sp=await searchParams||{},stage=BATCH_STAGES.includes(sp.stage)?sp.stage:'IDENTITY_PENDING';
  const retry=['new_only','new_and_technical','include_unresolved','all'].includes(sp.retry)?sp.retry:'new_only';
  const limit=Math.max(1,Math.min(5000,Number(sp.limit||25)));
  const [d,preview]=await Promise.all([getBatchControlOverview(),getBatchPreview({stage,retryMode:retry,limit})]);
  const paused=Boolean(d.control?.paused),active=d.activeRun,hasLive=Boolean(active&&['queued','running'].includes(active.status));
  const activeProgress=active?`${active.done+active.failed+active.review+active.cancelled+active.skipped}/${active.jobs}`:'—';
  const recentJobs=d.jobs.slice(0,50),recentRuns=d.runs.slice(0,12);

  return <>
    <AutoRefresh active={hasLive}/>
    <div className="page-head batch-head"><div><div className="eyebrow">Lifecycle Control Center</div><h1>Batch / Autopilot</h1><p>Resumen operativo. El detalle técnico vive dentro de cada job.</p></div><Link href="/admin">← Administración</Link></div>

    <div className="batch-statusbar compact-bar">
      <div><span>Motor</span><strong className={paused?'status warn':'status ok'}>{paused?'PAUSADO':'ACTIVO'}</strong></div>
      <div><span>Run</span><strong>{active?`#${active.id} · ${label(active.target_stage)}`:'Ninguno'}</strong></div>
      <div><span>Progreso</span><strong>{activeProgress}</strong></div>
      <div><span>Cola</span><strong>{d.summary.queued} · activos {d.summary.active}</strong></div>
      <div className="batch-status-actions">{paused?<form action={resumeBatchAction}><button>Reanudar</button></form>:<form action={pauseBatchAction}><input type="hidden" name="reason" value="Pausado desde Lifecycle Control Center"/><button className="danger">Pausar</button></form>}</div>
    </div>

    {active&&<section className="section compact-section batch-active"><div className="section-head"><div><h2>Run activo #{active.id}</h2><p>{label(active.target_stage)} · {retryLabel(active.limits?.retry_mode)} · {dt(active.started_at||active.created_at)}</p></div><strong>{activeProgress}</strong></div><div className="batch-outcomes compact-outcomes"><span className="status ok">Corregido {active.corrected}</span><span className="status warn">No encontrado {active.not_found}</span><span className="status warn">Incompleto {active.incomplete}</span><span>Sin cambios {active.no_change}</span><span className="status bad">Error {active.functional_error}</span><span className="status bad">Revisión {active.manual_review}</span></div><div className="quick-actions">{['running','queued'].includes(active.status)&&<form action={pauseRunAction}><input type="hidden" name="runId" value={active.id}/><button>Pausar run</button></form>}{active.status==='paused'&&<form action={resumeRunAction}><input type="hidden" name="runId" value={active.id}/><button>Reanudar run</button></form>}<form action={cancelRunAction}><input type="hidden" name="runId" value={active.id}/><button className="ghost danger-soft">Cancelar</button></form></div></section>}

    <section className="section compact-section" id="launch"><div className="section-head"><div><h2>Lanzar lote</h2><p>Previsualiza antes de ejecutar. El anti-bucle decide qué entra.</p></div></div><form action={previewBatchRunAction} className="batch-launch-form compact-launch"><label><span>Etapa</span><select name="stage" defaultValue={stage}>{BATCH_STAGES.map(s=><option key={s} value={s}>{label(s)}</option>)}</select></label><label><span>Tamaño</span><select name="limit" defaultValue={String(limit)}><option value="1">1</option><option value="5">5</option><option value="25">25</option><option value="100">100</option><option value="500">500</option></select></label><label><span>Política</span><select name="retryMode" defaultValue={retry}><option value="new_only">Solo nuevos</option><option value="new_and_technical">Nuevos + errores técnicos</option><option value="include_unresolved">Incluir no resueltos</option><option value="all">Forzar todos</option></select></label><button>Previsualizar</button></form>
      <div className="batch-preview compact-preview"><div className="batch-preview-main"><span>Entrarán</span><strong>{Math.min(preview.eligible,limit)}</strong><small>{preview.eligible} elegibles · {preview.counts.total} en etapa</small></div><div className="batch-preview-grid"><span><b>{preview.counts.new}</b>Nuevos</span><span><b>{preview.counts.context_changed}</b>Cambio contexto</span><span><b>{preview.counts.technical_due}</b>Error retry</span><span><b>{preview.counts.unresolved}</b>No resueltos</span><span><b>{preview.counts.cooldown}</b>Cooldown</span><span><b>{preview.counts.manual_review}</b>Revisión</span></div></div>
      <form action={createBatchRunAction} className="batch-create-run compact-create"><input type="hidden" name="stage" value={stage}/><input type="hidden" name="limit" value={limit}/><input type="hidden" name="retryMode" value={retry}/><button disabled={!preview.eligible}>Crear run de {Math.min(preview.eligible,limit)}</button><span>{retryLabel(retry)} · {paused?'quedará en espera':'se podrá ejecutar ya'}</span></form>
      <details className="batch-fold"><summary>Ver títulos preseleccionados ({Math.min(preview.selected.length,25)})</summary><div className="table-wrap"><table><thead><tr><th>Título</th><th>IMDb</th><th>Último resultado</th><th>Intentos</th></tr></thead><tbody>{preview.selected.slice(0,25).map(x=><tr key={x.imdb_id}><td><b>{x.title}</b><span className="sub">{x.year||'—'} · {x.type||'—'}</span></td><td>{x.imdb_id}</td><td>{x.last_outcome?<span className={`status ${outcomeClass(x.last_outcome)}`}>{x.last_outcome}</span>:'Nunca intentado'}</td><td>{x.attempt_count}</td></tr>)}</tbody></table></div></details>
    </section>

    <section className="section compact-section"><div className="section-head"><div><h2>Últimos jobs</h2><p>Una fila por título. Entra en “Detalle” para ver steps, respuestas e historial.</p></div></div><div className="table-wrap"><table><thead><tr><th>Job</th><th>Título</th><th>Etapa</th><th>Resultado</th><th>Lifecycle</th><th></th></tr></thead><tbody>{recentJobs.map(j=><tr key={j.id}><td>#{j.id}</td><td><b>{titleOf(j)}</b><span className="sub">{j.entity_id} · {j.year||'—'}</span></td><td>{label(j.stage)}</td><td>{j.functional_outcome?<span className={`status ${outcomeClass(j.functional_outcome)}`}>{j.functional_outcome}</span>:j.status}</td><td>{j.lifecycle_before||'—'} → {j.lifecycle_after||'—'}</td><td><Link className="title" href={`/admin/batch/job/${j.id}`}>Detalle →</Link></td></tr>)}</tbody></table></div></section>

    <details className="section batch-fold"><summary><b>Historial de runs</b> · últimos {recentRuns.length}</summary><div className="table-wrap"><table><thead><tr><th>Run</th><th>Etapa</th><th>Estado</th><th>Jobs</th><th>Corregidos</th><th>No encontrados</th><th>Errores</th><th>Fecha</th></tr></thead><tbody>{recentRuns.map(r=><tr key={r.id}><td>#{r.id}</td><td>{label(r.target_stage)}</td><td>{r.status}</td><td>{r.jobs}</td><td>{r.corrected}</td><td>{r.not_found}</td><td>{r.functional_error}</td><td>{dt(r.created_at)}</td></tr>)}</tbody></table></div></details>

    <details className="section batch-fold"><summary><b>Fuentes y límites</b> · {d.limits.length} fuentes</summary><div className="source-grid compact-sources">{d.limits.map(x=><div className="source-card" key={x.source}><div><b>{x.source}</b><span className={`status ${x.enabled&&x.breaker_state!=='open'?'ok':'warn'}`}>{x.enabled?x.breaker_state:'deshabilitada'}</span></div><p>{x.usage?.attempts||0} intentos hoy · {x.usage?.failures||0} fallos · media {x.usage?.avg_ms??'—'} ms</p><form action={updateSourceLimitAction} className="source-form"><input type="hidden" name="source" value={x.source}/><label><span>Presupuesto</span><input name="dailyBudget" type="number" min="0" defaultValue={x.daily_budget??''}/></label><label><span>Intervalo ms</span><input name="minIntervalMs" type="number" min="0" defaultValue={x.min_interval_ms??0}/></label><label><span>Concurrencia</span><input name="maxConcurrency" type="number" min="1" defaultValue={x.max_concurrency??1}/></label><label className="source-check"><input name="enabled" type="checkbox" defaultChecked={x.enabled}/><span>Activa</span></label><button>Guardar</button></form></div>)}</div></details>
  </>;
}
