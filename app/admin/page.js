import Link from 'next/link';
import {getOperationsOverview} from '@/lib/operations-queries';
import {processDisplay,kindDisplay,entityDisplay,triggerDisplay,executorDisplay} from '@/lib/process-display';
export const dynamic='force-dynamic';

const dt=v=>v?new Date(v).toLocaleString('es-ES',{dateStyle:'short',timeStyle:'medium'}):'—';
const duration=ms=>ms===null||ms===undefined?'—':ms<1000?`${ms} ms`:ms<60000?`${(ms/1000).toFixed(1)} s`:`${(ms/60000).toFixed(1)} min`;
const statusLabel={queued:'En cola',running:'En curso',succeeded:'Correcto',failed:'Fallido',partial:'Parcial',cancelled:'Cancelado'};
const resultLabel={updated:'Actualizado',no_change:'Sin cambios',pending:'Pendiente',blocked:'Bloqueado',not_found:'No encontrado',invalid:'Inválido'};
const tone=s=>s==='succeeded'?'ok':s==='failed'?'bad':s==='partial'||s==='queued'?'warn':s==='running'?'live':'muted';
function qs(p,patch={}){const x=new URLSearchParams();for(const[k,v]of Object.entries({...p,...patch}))if(v!==undefined&&v!==null&&v!=='')x.set(k,String(v));return x.toString()}

export default async function Operations({searchParams}){
  const p=await searchParams;
  const d=await getOperationsOverview(p);
  const s=d.summary||{};
  const successRate=Number(s.runs_24h)>0?Math.round(Number(s.succeeded_24h||0)*100/Number(s.runs_24h)):0;
  return <div className="ops-shell">
    <header className="ops-hero">
      <div><div className="ops-kicker">Centro de Operaciones</div><h1>Procesos y trazabilidad</h1><p>Vista canónica de lo que PikoFilm ejecuta: quién lo pidió, dónde corrió, qué ocurrió y dónde falló.</p></div>
      <div className="ops-live"><span className={Number(s.active)>0?'dot live':'dot'}></span>{Number(s.active)>0?`${s.active} en ejecución`:'Sin procesos activos'}</div>
    </header>

    <section className="ops-kpis">
      <article><span>Activos</span><strong>{s.active||0}</strong><small>En cola o ejecutándose</small></article>
      <article><span>Ejecuciones · 24 h</span><strong>{s.runs_24h||0}</strong><small>{successRate}% correctas</small></article>
      <article className={Number(s.open_errors)>0?'attention':''}><span>Errores abiertos</span><strong>{s.open_errors||0}</strong><small>{s.failed_24h||0} fallos en 24 h</small></article>
      <article><span>Tiempo medio · 24 h</span><strong>{duration(Number(s.avg_duration_ms||0))}</strong><small>Solo ejecuciones con duración</small></article>
    </section>

    <div className="ops-grid">
      <section className="ops-panel ops-main-panel">
        <div className="ops-panel-head"><div><span className="ops-label">Ejecuciones</span><h2>Ejecuciones recientes</h2></div><Link className="ops-refresh" href={'/admin?'+qs(p)}>Actualizar</Link></div>
        <form className="ops-filters" method="get">
          <select name="status" defaultValue={p.status||''}><option value="">Todos los estados</option><option value="queued">En cola</option><option value="running">En curso</option><option value="succeeded">Correctos</option><option value="failed">Fallidos</option><option value="partial">Parciales</option><option value="cancelled">Cancelados</option></select>
          <select name="kind" defaultValue={p.kind||''}><option value="">Todos los tipos</option><option value="individual">Individual</option><option value="batch">Batch</option><option value="system">Sistema</option></select>
          <input name="process" defaultValue={p.process||''} placeholder="Proceso, p. ej. PROC-ID-001"/>
          <input name="entity" defaultValue={p.entity||''} placeholder="Entidad / IMDb ID"/>
          <button>Filtrar</button><Link href="/admin">Limpiar</Link>
        </form>
        {d.runs.length===0?<div className="ops-empty"><b>Aún no hay ejecuciones trazadas</b><span>Las ejecuciones canónicas aparecerán aquí cuando se lancen.</span></div>:<div className="ops-runs">{d.runs.map(r=>{const proc=processDisplay(r.process_code);return <Link href={`/admin/runs/${r.run_id}`} className="ops-run" key={r.run_id}>
          <div className={`ops-status-line ${tone(r.technical_status)}`}></div>
          <div className="ops-run-main"><div className="ops-run-title"><strong>{proc.name}</strong><span className="ops-kind">{kindDisplay(r.run_kind)}</span>{r.functional_result&&<span className="ops-result">{resultLabel[r.functional_result]||r.functional_result}</span>}</div><p>{proc.code} · {entityDisplay(r.entity_type)}{r.entity_id?` · ${r.entity_id}`:''}</p><small>{triggerDisplay(r.trigger_source)} → {executorDisplay(r.executor)} · {dt(r.requested_at)}</small></div>
          <div className="ops-run-meta"><span className={`ops-badge ${tone(r.technical_status)}`}>{statusLabel[r.technical_status]||r.technical_status}</span><b>{duration(r.duration_ms)}</b>{r.error_count>0&&<em>{r.error_count} error{r.error_count===1?'':'es'}</em>}</div>
        </Link>})}</div>}
      </section>

      <aside className="ops-side">
        <section className="ops-panel"><div className="ops-panel-head"><div><span className="ops-label">Atención</span><h2>Errores abiertos</h2></div></div>{d.errors.length===0?<div className="ops-empty compact"><b>Sin errores abiertos</b><span>Los fallos estructurados aparecerán aquí.</span></div>:<div className="ops-errors">{d.errors.map(e=>{const proc=processDisplay(e.process_code);return <Link href={`/admin/runs/${e.run_id}`} key={e.error_id}><div><strong>{proc.name}</strong><span>{e.step||e.error_code||'Error'}</span></div><p>{e.message}</p><small>{proc.code} · {dt(e.occurred_at)}{e.retryable?' · reintentable':''}</small></Link>})}</div>}</section>
        <section className="ops-panel"><div className="ops-panel-head"><div><span className="ops-label">Procesos</span><h2>Actividad registrada</h2></div></div>{d.processes.length===0?<div className="ops-empty compact"><span>Sin procesos registrados todavía.</span></div>:<div className="ops-processes">{d.processes.map(x=>{const proc=processDisplay(x.process_code);return <div key={x.process_code}><strong>{proc.name}</strong><span>{proc.code} · {x.total} ejecuciones · {x.problematic} con incidencia</span><small>{dt(x.last_run_at)}</small></div>})}</div>}</section>
        <section className="ops-panel ops-batch-placeholder"><span className="ops-label">Batch</span><h2>Orquestación</h2><p>Reservado para la futura capa Batch construida como N ejecuciones del proceso individual canónico.</p><span className="ops-coming">Pendiente de individuales</span></section>
      </aside>
    </div>
  </div>
}
