import Link from 'next/link';
import Kpi from '@/components/Kpi';
import {BATCH_STAGES,getBatchControlOverview} from '@/lib/batch-control';
import {createBatchRunAction,pauseBatchAction,resumeBatchAction,pauseRunAction,resumeRunAction,cancelRunAction,updateSourceLimitAction} from './actions';

export const dynamic='force-dynamic';
const dt=v=>v?new Date(v).toLocaleString('es-ES'):'—';
const label=s=>({IDENTITY_PENDING:'Identidad',IDENTITY_VALIDATION:'Validación identidad',DATA_INCOMPLETE:'Datos',PIKOSCORE_PENDING:'PikoScore',MOVIE_FILE_PENDING:'Validación película',SERIES_SYNC_PENDING:'Series',TECH_PENDING:'PikoQuality'}[s]||s);

export default async function BatchAdmin(){
  const d=await getBatchControlOverview(),paused=Boolean(d.control?.paused);
  return <>
    <div className="page-head"><div><div className="eyebrow">M46 · Batch Engine</div><h1>Autopilot / Cola segura</h1><p>Panel de control del motor batch. En M46-A solo prepara y administra la cola: todavía no existe ningún worker que ejecute estos jobs.</p></div><Link href="/admin">← Administración</Link></div>
    <div className="mini-kpis"><Kpi label="Runs" value={d.summary.runs}/><Kpi label="Jobs" value={d.summary.jobs}/><Kpi label="En cola" value={d.summary.queued}/><Kpi label="Activos" value={d.summary.active}/><Kpi label="Retry" value={d.summary.retry}/><Kpi label="Revisión" value={d.summary.review}/><Kpi label="Fallidos" value={d.summary.failed}/></div>

    <section className="section"><div className="section-head"><div><h2>Kill switch global</h2><p>Debe estar pausado mientras M46-A no tenga execution plane aprobado.</p></div><strong>{paused?'PAUSADO':'PREPARADO'}</strong></div>
      {paused?<form action={resumeBatchAction}><button>Reanudar control</button></form>:<form action={pauseBatchAction} className="filters compact"><input name="reason" defaultValue="Pausado por el usuario"/><button className="danger">Pausar Autopilot</button></form>}
      <p className="muted">Último cambio: {dt(d.control?.updated_at)} · {d.control?.updated_by||'—'}{d.control?.pause_reason?` · ${d.control.pause_reason}`:''}</p>
    </section>

    <section className="section"><div className="section-head"><div><h2>Preparar lote por etapa</h2><p>Crea jobs persistentes a partir del Lifecycle actual. No los ejecuta.</p></div></div>
      <form action={createBatchRunAction} className="filters compact"><select name="stage" defaultValue="PIKOSCORE_PENDING">{BATCH_STAGES.map(s=><option value={s} key={s}>{label(s)} · {s}</option>)}</select><input name="limit" type="number" min="1" max="5000" defaultValue="100"/><button>Crear run</button></form>
    </section>

    <section className="section"><div className="section-head"><div><h2>Límites por fuente</h2><p>Todas las fuentes nacen deshabilitadas. Modificar estos límites no ejecuta nada mientras no exista worker.</p></div></div>
      <div className="table-wrap"><table><thead><tr><th>Fuente</th><th>Activa</th><th>Concurrencia</th><th>Intervalo ms</th><th>Presupuesto/día</th><th>Breaker</th><th>Bloqueada hasta</th><th></th></tr></thead><tbody>{d.limits.map(x=><tr key={x.source}><td><b>{x.source}</b></td><td colSpan="7"><form action={updateSourceLimitAction} className="filters compact"><input type="hidden" name="source" value={x.source}/><label><input type="checkbox" name="enabled" defaultChecked={x.enabled}/> habilitada</label><input name="maxConcurrency" type="number" min="0" max="16" defaultValue={x.max_concurrency}/><input name="minIntervalMs" type="number" min="0" max="600000" defaultValue={x.min_interval_ms}/><input name="dailyBudget" type="number" min="0" placeholder="sin límite" defaultValue={x.daily_budget??''}/><span>{x.breaker_state}</span><span>{dt(x.blocked_until)}</span><button>Guardar</button></form></td></tr>)}</tbody></table></div>
    </section>

    <section className="section"><div className="section-head"><div><h2>Runs recientes</h2><p>Pausa/cancelación son persistentes; cancelar conserva jobs ya terminados.</p></div></div><div className="process-list">{d.runs.length?d.runs.map(r=><details className={`process-card process-${r.status}`} key={r.id}><summary><div><b>#{r.id} · {r.mode} · {label(r.target_stage)}</b><span>{dt(r.created_at)} · {r.status}</span></div><div className="process-stats"><span>{r.jobs} jobs</span><span>{r.done} done</span><span>{r.review} review</span><span>{r.failed} failed</span></div></summary><div className="process-detail"><div className="tech-grid"><span><b>Queued</b>{r.queued}</span><span><b>Activos</b>{r.active}</span><span><b>Retry</b>{r.retry_wait}</span><span><b>Cancelados</b>{r.cancelled}</span><span><b>Inicio</b>{dt(r.started_at)}</span><span><b>Fin</b>{dt(r.finished_at)}</span></div>{r.stop_reason&&<p>{r.stop_reason}</p>}<div className="quick-actions">{r.status==='queued'&&<form action={pauseRunAction}><input type="hidden" name="runId" value={r.id}/><button>Pausar run</button></form>}{r.status==='paused'&&<form action={resumeRunAction}><input type="hidden" name="runId" value={r.id}/><button>Reanudar run</button></form>}{!['completed','cancelled'].includes(r.status)&&<form action={cancelRunAction}><input type="hidden" name="runId" value={r.id}/><button className="ghost danger-soft">Cancelar run</button></form>}</div></div></details>):<p>No hay runs batch todavía.</p>}</div></section>

    <section className="section"><div className="section-head"><div><h2>Últimos jobs</h2><p>Visibilidad de cola y leases. M46-A debe permanecer sin jobs activos.</p></div></div><div className="table-wrap"><table><thead><tr><th>ID</th><th>Run</th><th>Entidad</th><th>Etapa</th><th>Estado</th><th>Intento</th><th>Disponible</th><th>Lease</th><th>Worker</th></tr></thead><tbody>{d.jobs.map(j=><tr key={j.id}><td>{j.id}</td><td>#{j.run_id}</td><td>{j.entity_id}</td><td>{label(j.stage)}</td><td>{j.status}</td><td>{j.attempt}</td><td>{dt(j.available_at)}</td><td>{dt(j.leased_until)}</td><td>{j.worker_id||'—'}</td></tr>)}</tbody></table></div></section>
  </>;
}
