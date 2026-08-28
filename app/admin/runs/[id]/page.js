import Link from 'next/link';
import {notFound} from 'next/navigation';
import {getRunDetail} from '@/lib/operations-queries';
import {processDisplay,kindDisplay,entityDisplay,triggerDisplay,executorDisplay} from '@/lib/process-display';
export const dynamic='force-dynamic';

const dt=v=>v?new Date(v).toLocaleString('es-ES',{dateStyle:'medium',timeStyle:'medium'}):'—';
const duration=ms=>ms===null||ms===undefined?'—':ms<1000?`${ms} ms`:ms<60000?`${(ms/1000).toFixed(1)} s`:`${(ms/60000).toFixed(1)} min`;
const labels={queued:'En cola',running:'En curso',succeeded:'Correcto',failed:'Fallido',partial:'Parcial',cancelled:'Cancelado'};
const results={updated:'Actualizado',no_change:'Sin cambios',pending:'Pendiente',blocked:'Bloqueado',not_found:'No encontrado',invalid:'Inválido'};
const tone=s=>s==='succeeded'?'ok':s==='failed'?'bad':s==='partial'||s==='queued'?'warn':s==='running'?'live':'muted';
const pretty=v=>v&&Object.keys(v).length?JSON.stringify(v,null,2):null;

export default async function RunDetail({params}){
  const{id}=await params;
  if(!/^[0-9a-f-]{36}$/i.test(id))notFound();
  const d=await getRunDetail(id);
  const r=d.run;if(!r)notFound();
  const proc=processDisplay(r.process_code);
  return <div className="ops-shell">
    <Link className="ops-back" href="/admin">← Centro de Operaciones</Link>
    <header className="ops-detail-hero"><div><div className="ops-kicker">Ejecución · {proc.code}</div><h1>{proc.name}</h1><p>{entityDisplay(r.entity_type)}{r.entity_id?` · ${r.entity_id}`:''}</p></div><div className="ops-detail-state"><span className={`ops-badge ${tone(r.technical_status)}`}>{labels[r.technical_status]||r.technical_status}</span>{r.functional_result&&<strong>{results[r.functional_result]||r.functional_result}</strong>}</div></header>

    <section className="ops-detail-grid">
      <article><span>Solicitado</span><strong>{dt(r.requested_at)}</strong><small>{triggerDisplay(r.trigger_source)}</small></article>
      <article><span>Ejecutor</span><strong>{executorDisplay(r.executor)}</strong><small>{kindDisplay(r.run_kind)}</small></article>
      <article><span>Duración</span><strong>{duration(r.duration_ms)}</strong><small>{r.started_at?`${dt(r.started_at)} → ${dt(r.finished_at)}`:'Aún no iniciada'}</small></article>
      <article><span>Actividad</span><strong>{r.external_calls||0} llamadas externas</strong><small>{r.retry_count||0} reintentos · {r.error_count||0} errores</small></article>
    </section>

    <div className="ops-detail-columns">
      <section className="ops-panel"><div className="ops-panel-head"><div><span className="ops-label">Cronología</span><h2>Eventos significativos</h2></div></div>{d.events.length===0?<div className="ops-empty compact"><span>Esta ejecución no tiene eventos registrados.</span></div>:<div className="ops-timeline">{d.events.map(ev=><article key={ev.event_id}><span className="ops-timeline-dot"></span><div><div><strong>{ev.step||ev.event_type}</strong><time>{dt(ev.occurred_at)}</time></div>{ev.message&&<p>{ev.message}</p>}<small>{ev.event_type}{ev.duration_ms!==null?` · ${duration(ev.duration_ms)}`:''}</small>{pretty(ev.data)&&<pre>{pretty(ev.data)}</pre>}</div></article>)}</div>}</section>

      <aside className="ops-detail-side">
        <section className="ops-panel"><div className="ops-panel-head"><div><span className="ops-label">Errores</span><h2>Incidencias</h2></div></div>{d.errors.length===0?<div className="ops-empty compact"><b>Sin errores</b></div>:<div className="ops-detail-errors">{d.errors.map(e=><article key={e.error_id}><div><strong>{e.error_code||e.error_class||'ERROR'}</strong>{e.resolved_at?<span className="resolved">Resuelto</span>:<span>Abierto</span>}</div><p>{e.message}</p><small>{e.step||'sin paso'} · {e.source||'sin fuente'} · {dt(e.occurred_at)}</small>{e.retryable&&<em>Reintentable · intento {e.retry_attempt}</em>}{e.resolution&&<p className="resolution">{e.resolution}</p>}{pretty(e.detail)&&<pre>{pretty(e.detail)}</pre>}</article>)}</div>}</section>
        <section className="ops-panel"><div className="ops-panel-head"><div><span className="ops-label">Correlación</span><h2>Identificadores técnicos</h2></div></div><dl className="ops-dl"><div><dt>Código de proceso</dt><dd>{proc.code}</dd></div><div><dt>Run ID</dt><dd>{r.run_id}</dd></div><div><dt>Parent</dt><dd>{r.parent_run_id||'—'}</dd></div><div><dt>Correlation</dt><dd>{r.correlation_key||'—'}</dd></div><div><dt>Idempotency</dt><dd>{r.idempotency_key||'—'}</dd></div></dl></section>
      </aside>
    </div>

    {d.children.length>0&&<section className="ops-panel ops-children"><div className="ops-panel-head"><div><span className="ops-label">Hijos</span><h2>Ejecuciones relacionadas</h2></div></div><div className="ops-runs">{d.children.map(c=>{const child=processDisplay(c.process_code);return <Link className="ops-run" href={`/admin/runs/${c.run_id}`} key={c.run_id}><div className={`ops-status-line ${tone(c.technical_status)}`}></div><div className="ops-run-main"><strong>{child.name}</strong><p>{child.code} · {entityDisplay(c.entity_type)}{c.entity_id?` · ${c.entity_id}`:''}</p><small>{dt(c.requested_at)}</small></div><div className="ops-run-meta"><span className={`ops-badge ${tone(c.technical_status)}`}>{labels[c.technical_status]||c.technical_status}</span><b>{duration(c.duration_ms)}</b></div></Link>})}</div></section>}

    {(pretty(r.metrics)||pretty(r.context)||pretty(r.before_compact)||pretty(r.after_compact))&&<section className="ops-panel ops-technical"><div className="ops-panel-head"><div><span className="ops-label">Contexto compacto</span><h2>Datos técnicos</h2></div></div><div className="ops-json-grid">{pretty(r.metrics)&&<div><b>Métricas</b><pre>{pretty(r.metrics)}</pre></div>}{pretty(r.context)&&<div><b>Contexto</b><pre>{pretty(r.context)}</pre></div>}{pretty(r.before_compact)&&<div><b>Antes</b><pre>{pretty(r.before_compact)}</pre></div>}{pretty(r.after_compact)&&<div><b>Después</b><pre>{pretty(r.after_compact)}</pre></div>}</div></section>}
  </div>
}
