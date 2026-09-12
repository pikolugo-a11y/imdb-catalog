import Link from '@/components/NoPrefetchLink';
import ActionButton from '@/components/ActionButton';
import {getOperationsOverview} from '@/lib/operations-queries';
import {getBatchApiSources} from '@/lib/batch-api-admin';
import {getPikoQualityOperationsHealth} from '@/lib/pikoquality-operations-health';
import {processDisplay,entityDisplay,triggerDisplay,executorDisplay} from '@/lib/process-display';
import OperationsResetTitle from '@/components/OperationsResetTitle';
import OperationsApiSources from '@/components/OperationsApiSources';
import OperationsBatchControl from '@/components/OperationsBatchControl';
import {cancelRunAction,resolveIncidentAction} from './actions';
export const dynamic='force-dynamic';

const dt=v=>v?new Date(v).toLocaleString('es-ES',{dateStyle:'short',timeStyle:'short'}):'—';
const duration=ms=>ms===null||ms===undefined?'—':ms<1000?`${ms} ms`:ms<60000?`${(ms/1000).toFixed(1)} s`:`${(ms/60000).toFixed(1)} min`;
const age=v=>{if(!v)return'—';const ms=Math.max(0,Date.now()-new Date(v).getTime()),m=Math.floor(ms/60000);return m<1?'menos de 1 min':m<60?`${m} min`:m<1440?`${Math.floor(m/60)} h ${m%60} min`:`${Math.floor(m/1440)} d ${Math.floor((m%1440)/60)} h`};
const statusLabel={queued:'En cola',running:'En curso',succeeded:'Correcto',failed:'Fallido',partial:'Parcial',cancelled:'Cancelado'};
const resultLabel={updated:'Actualizado',no_change:'Sin cambios',pending:'Pendiente',blocked:'Bloqueado',not_found:'No encontrado',invalid:'Inválido'};
const tone=s=>s==='succeeded'?'ok':s==='failed'?'bad':s==='partial'||s==='queued'?'warn':s==='running'?'live':'muted';
function adminHref(p,patch={}){const x=new URLSearchParams();for(const[k,v]of Object.entries({...p,...patch}))if(v!==undefined&&v!==null&&v!=='')x.set(k,String(v));const q=x.toString();return `/admin${q?`?${q}`:''}`}

function healthItems(d,sources,pq){
  const h=d.health||{},items=[];
  if(h.engine_state!=='running')items.push({tone:'bad',title:'Batch Engine detenido',text:`Estado efectivo: ${h.engine_state}`});
  if(Number(h.expired_leases)>0)items.push({tone:'bad',title:'Leases vencidas',text:`${h.expired_leases} item(s) necesitan reconciliación`});
  if(Number(h.stale_runs)>0)items.push({tone:'warn',title:'Ejecuciones atascadas',text:`${h.stale_runs} de ${h.active_runs||0} activas llevan más de 15 min sin actividad`});
  if(Number(pq?.capturePending)>0)items.push({tone:'warn',title:'Captura técnica PikoQuality pendiente',text:`${pq.capturePending} archivo(s) sin captura vigente · ${pq.captureErrors||0} con error`});
  for(const x of sources||[]){if(x.breaker_state&&x.breaker_state!=='closed')items.push({tone:'bad',title:`${String(x.source).toUpperCase()} bloqueada`,text:x.blocked_until?`Hasta ${dt(x.blocked_until)}`:'Circuit breaker abierto'});}
  if(Number(d.summary?.active_incidents)>0)items.push({tone:'warn',title:'Incidencias activas',text:`${d.summary.active_incidents} grupo(s) · ${d.summary.active_error_occurrences||0} error(es) agrupados`});
  return items;
}

function RunRow({r,active=false}){
  const proc=processDisplay(r.process_code),stale=Boolean(r.stale);
  return <div className={`ops-run ${active?'active':''} ${stale?'stale':''}`}>
    <div className={`ops-status-line ${stale?'bad':tone(r.technical_status)}`}></div>
    <div className="ops-run-main">
      <div className="ops-run-title"><strong>{proc.name}</strong>{active&&<span className={`ops-result ${stale?'stale':''}`}>{stale?'Atascada':'Activa'}</span>}{!active&&r.match_reason&&<span className="ops-result">{r.match_reason}</span>}</div>
      <p>{proc.code} · {entityDisplay(r.entity_type)}{r.entity_label?` · ${r.entity_label}`:r.entity_id?` · ${r.entity_id}`:''}</p>
      <small>{triggerDisplay(r.trigger_source)} → {executorDisplay(r.executor)} · iniciada {dt(r.started_at||r.requested_at)}{active?` · ${age(r.started_at||r.requested_at)}`:''}</small>
    </div>
    <div className="ops-run-meta"><span className={`ops-badge ${stale?'bad':tone(r.technical_status)}`}>{stale?'Atascada':statusLabel[r.technical_status]||r.technical_status}</span>{r.functional_result&&<b>{resultLabel[r.functional_result]||r.functional_result}</b>}{!active&&<small>{duration(r.duration_ms)}</small>}</div>
    <div className="ops-run-actions"><Link href={`/admin/runs/${r.run_id}`}>Diagnosticar</Link>{active&&(stale||r.controllable_batch)&&<ActionButton action={cancelRunAction} fields={{runId:r.run_id}} label={r.controllable_batch?'Cancelar':'Cerrar como cancelada'} pendingLabel="Cancelando…" className="button ghost"/>}</div>
  </div>;
}

export default async function Operations({searchParams}){
  const p=await searchParams;
  const[d,apiSources,pqHealth]=await Promise.all([getOperationsOverview(p),getBatchApiSources(),getPikoQualityOperationsHealth()]);
  const health=healthItems(d,apiSources,pqHealth),healthy=health.length===0;
  const attentionTarget=Number(d.health?.stale_runs)>0?'#active-runs':Number(d.summary?.active_incidents)>0?'#incidents':Number(pqHealth.capturePending)>0?'#mantenimiento':'#control';
  return <div className="ops-shell">
    <header className="ops-hero"><div><div className="ops-kicker">Operaciones V4</div><h1>Busca, entiende y actúa</h1><p>El estado vivo está siempre visible. Usa la búsqueda para historial y diagnóstico; actúa sólo sobre ejecuciones o incidencias que realmente lo necesiten.</p></div><Link className="ops-live" href={attentionTarget}><span className={healthy?'dot live':'dot'}></span>{healthy?'Sistema operativo':`${health.length} punto(s) de atención`}</Link></header>

    <section className={`ops-health ${healthy?'healthy':'attention'}`}><div><span className="ops-label">Salud operativa</span><h2>{healthy?'Todo funciona con normalidad':'Hay elementos que requieren atención'}</h2><p>{healthy?`${d.health?.active_runs||0} ejecución(es) activa(s) · ${d.health?.active_batches||0} Batch activos · 0 incidencias`:'Las anomalías actuales están separadas del historial. Cada cifra usa la misma unidad que su listado.'}</p></div>{!healthy&&<div className="ops-health-items">{health.map((x,i)=><article key={`${x.title}-${i}`} className={x.tone}><strong>{x.title}</strong><span>{x.text}</span></article>)}</div>}</section>

    <section id="active-runs" className="ops-panel ops-active-panel"><div className="ops-panel-head"><div><span className="ops-label">Estado vivo</span><h2>Ejecuciones activas</h2><p>Siempre visibles mientras estén en cola o en curso. Una ejecución sin actividad durante 15 minutos se marca como atascada.</p></div><span className={`ops-count ${Number(d.health?.stale_runs)>0?'warn':''}`}>{d.summary?.active||0} activas{Number(d.health?.stale_runs)>0?` · ${d.health.stale_runs} atascadas`:''}</span></div>{d.activeRuns.length===0?<div className="ops-empty compact"><b>No hay ejecuciones activas</b><span>Los procesos terminados siguen disponibles mediante búsqueda.</span></div>:<div className="ops-runs ops-active-runs">{d.activeRuns.map(r=><RunRow key={r.run_id} r={r} active/>)}</div>}</section>

    <section className="ops-search-panel"><form method="get" className="ops-search"><div className="ops-search-head"><div><span className="ops-label">Búsqueda e historial</span><h2>Encuentra ejecuciones concretas</h2><p>Texto libre y filtros funcionan por separado o combinados. El estado queda en la URL al buscar.</p></div>{d.hasFilters&&<Link className="ops-refresh" href="/admin">Limpiar filtros</Link>}</div><div className="ops-search-row"><input name="q" defaultValue={p.q||''} placeholder="IMDb ID, run_id, proceso, título, persona, error, origen…" autoComplete="off"/><button>Buscar</button></div><div className="ops-filter-title"><strong>Filtros de ejecuciones</strong><span>No se ocultan al aplicar la búsqueda</span></div><div className="ops-filters persistent"><label><span>Estado</span><select name="status" defaultValue={p.status||''}><option value="">Todos</option><option value="queued">En cola</option><option value="running">En curso</option><option value="succeeded">Correctos</option><option value="failed">Fallidos</option><option value="partial">Parciales</option><option value="cancelled">Cancelados</option></select></label><label><span>Tipo</span><select name="kind" defaultValue={p.kind||''}><option value="">Todos</option><option value="individual">Individual</option><option value="batch">Batch</option><option value="system">Sistema</option></select></label><label><span>Proceso</span><input name="process" defaultValue={p.process||''} placeholder="PROC-SER-002"/></label><label><span>Entidad</span><input name="entity" defaultValue={p.entity||''} placeholder="ID de entidad"/></label><label><span>Origen / trigger</span><input name="trigger" defaultValue={p.trigger||''} placeholder="manual, cron, planner…"/></label><label><span>Executor / fuente de error</span><input name="source" defaultValue={p.source||''} placeholder="Railway, Vercel, TMDb…"/></label><label><span>Periodo</span><select name="period" defaultValue={p.period||'30d'}><option value="24h">24 horas</option><option value="7d">7 días</option><option value="30d">30 días</option></select></label></div><div className="ops-filter-actions"><button>Aplicar filtros</button>{d.hasFilters&&<Link href="/admin">Restablecer</Link>}</div></form>
      {d.hasFilters&&<div className="ops-search-results"><div className="ops-panel-head"><div><span className="ops-label">Resultados</span><h2>{d.searchResults.length} ejecución(es) en esta página{d.query?` para “${d.query}”`:''}</h2><p>Página {d.searchPage} · 50 resultados como máximo por página</p></div></div>{d.searchResults.length===0?<div className="ops-empty"><b>No encontramos ejecuciones con esos criterios</b><span>Cambia un filtro o restablece la búsqueda; los filtros funcionan sin necesidad de escribir texto.</span></div>:<div className="ops-runs">{d.searchResults.map(r=><RunRow key={r.run_id} r={r}/>)}</div>}{(d.searchPage>1||d.searchHasMore)&&<nav className="ops-filter-actions" aria-label="Paginación de resultados">{d.searchPage>1?<Link href={adminHref(p,{page:d.searchPage-1})}>← Más recientes</Link>:<span/>}{d.searchHasMore?<Link href={adminHref(p,{page:d.searchPage+1})}>Más antiguas →</Link>:<span/>}</nav>}</div>}
    </section>

    <section id="incidents" className="ops-panel"><div className="ops-panel-head"><div><span className="ops-label">Atención actual</span><h2>Incidencias activas</h2><p>{d.summary?.active_incidents||0} grupo(s) de incidencia · {d.summary?.active_error_occurrences||0} ocurrencia(s) sin resolver.</p></div><span className="ops-coming">30 días de historial</span></div>{d.incidents.length===0?<div className="ops-empty compact"><b>Sin incidencias activas</b><span>Los fallos ya resueltos o superados por una ejecución correcta no aparecen aquí.</span></div>:<><div className="ops-incident-list">{d.incidents.map((e,i)=>{const proc=processDisplay(e.process_code);return <article key={`${e.process_code}-${e.error_key}-${e.step}-${i}`}><div className="ops-incident-main"><div><strong>{proc.name}</strong><span>{e.error_key}{e.source?` · ${e.source}`:''}</span></div><p>{e.message}</p><small>{e.occurrences} error(es) · {e.affected_runs} ejecución(es) · {e.affected_entities} entidad(es) · primera {dt(e.first_seen)} · última {dt(e.last_seen)}</small></div><div className="ops-incident-actions"><Link href={`/admin/runs/${e.sample_run_id}`}>Diagnosticar</Link><ActionButton action={resolveIncidentAction} fields={{errorId:e.sample_error_id,grouped:'1',processCode:e.process_code,step:e.step,errorKey:e.error_key,source:e.source}} label="Descartar grupo" pendingLabel="Descartando…" className="button ghost"/></div></article>})}</div>{(d.incidentPage>1||d.incidentHasMore)&&<nav className="ops-filter-actions" aria-label="Paginación de incidencias"><span>Página {d.incidentPage}</span><div>{d.incidentPage>1&&<Link href={adminHref(p,{incidentPage:d.incidentPage-1})+'#incidents'}>← Más recientes</Link>}{d.incidentHasMore&&<Link href={adminHref(p,{incidentPage:d.incidentPage+1})+'#incidents'}>Más antiguas →</Link>}</div></nav>}</>}</section>

    <section id="control" className="ops-control"><div className="ops-control-head"><span className="ops-label">Centro de control</span><h2>Actúa sólo donde hace falta</h2><p>Los controles técnicos quedan separados del diagnóstico cotidiano. Las acciones delicadas muestran resultado y conservan historial.</p></div><div className="ops-control-nav"><a href="#sistema">Sistema / Batch</a><a href="#fuentes">Fuentes y límites</a><a href="#recuperacion">Recuperación</a><a href="#mantenimiento">Mantenimiento</a></div>
      <div id="sistema"><OperationsBatchControl/></div>
      <div id="fuentes" className="ops-domain"><OperationsApiSources sources={apiSources}/></div>
      <div id="recuperacion" className="ops-domain"><OperationsResetTitle/></div>
      <section id="mantenimiento" className="ops-panel ops-domain"><div className="ops-panel-head"><div><span className="ops-label">Mantenimiento</span><h2>Operaciones seguras y explícitas</h2></div></div><div className="ops-maintenance"><Link href="/admin/pikoquality"><strong>Mantenimiento PikoQuality</strong><span>{pqHealth.capturePending>0?`${pqHealth.capturePending} archivo(s) necesitan captura técnica${pqHealth.captureErrors>0?` · ${pqHealth.captureErrors} con error`:''}`:'Captura técnica y C6 sin deuda física pendiente.'}</span></Link><Link href="/admin/sistema"><strong>Diagnóstico de sistema y almacenamiento</strong><span>Consulta estado técnico sin modificar datos.</span></Link><article><strong>Reconciliación automática de leases</strong><span>El worker Batch recupera leases vencidas mediante el mecanismo canónico; aquí se muestra como protección, no como botón indiscriminado.</span></article></div></section>
    </section>
  </div>;
}
