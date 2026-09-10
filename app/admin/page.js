import Link from '@/components/NoPrefetchLink';
import {getOperationsOverview} from '@/lib/operations-queries';
import {getBatchApiSources} from '@/lib/batch-api-admin';
import {processDisplay,kindDisplay,entityDisplay,triggerDisplay,executorDisplay} from '@/lib/process-display';
import OperationsResetTitle from '@/components/OperationsResetTitle';
import OperationsApiSources from '@/components/OperationsApiSources';
import OperationsBatchControl from '@/components/OperationsBatchControl';
import {resolveIncidentAction} from './actions';
export const dynamic='force-dynamic';

const dt=v=>v?new Date(v).toLocaleString('es-ES',{dateStyle:'short',timeStyle:'short'}):'—';
const duration=ms=>ms===null||ms===undefined?'—':ms<1000?`${ms} ms`:ms<60000?`${(ms/1000).toFixed(1)} s`:`${(ms/60000).toFixed(1)} min`;
const statusLabel={queued:'En cola',running:'En curso',succeeded:'Correcto',failed:'Fallido',partial:'Parcial',cancelled:'Cancelado'};
const resultLabel={updated:'Actualizado',no_change:'Sin cambios',pending:'Pendiente',blocked:'Bloqueado',not_found:'No encontrado',invalid:'Inválido'};
const tone=s=>s==='succeeded'?'ok':s==='failed'?'bad':s==='partial'||s==='queued'?'warn':s==='running'?'live':'muted';

function healthItems(d,sources){
  const h=d.health||{},items=[];
  if(h.engine_state!=='running')items.push({tone:'bad',title:'Batch Engine detenido',text:`Estado efectivo: ${h.engine_state}`});
  if(Number(h.expired_leases)>0)items.push({tone:'bad',title:'Leases vencidas',text:`${h.expired_leases} item(s) necesitan reconciliación`});
  if(Number(h.long_running)>0)items.push({tone:'warn',title:'Ejecuciones largas',text:`${h.long_running} llevan más de 2 horas en curso`});
  for(const x of sources||[]){
    if(x.breaker_state&&x.breaker_state!=='closed')items.push({tone:'bad',title:`${String(x.source).toUpperCase()} bloqueada`,text:x.blocked_until?`Hasta ${dt(x.blocked_until)}`:'Circuit breaker abierto'});
  }
  if(Number(d.summary?.active_incidents)>0)items.push({tone:'warn',title:'Incidencias activas',text:`${d.summary.active_incidents} error(es) todavía requieren atención`});
  return items;
}

export default async function Operations({searchParams}){
  const p=await searchParams;
  const[d,apiSources]=await Promise.all([getOperationsOverview(p),getBatchApiSources()]);
  const health=healthItems(d,apiSources),healthy=health.length===0;
  return <div className="ops-shell">
    <header className="ops-hero"><div><div className="ops-kicker">Operaciones V4</div><h1>Busca, entiende y actúa</h1><p>Encuentra una ejecución, entidad, proceso, Batch o error concreto. Primero te explicamos qué pasó; el detalle técnico queda disponible cuando lo necesitas.</p></div><Link className="ops-live" href="#control"><span className={healthy?'dot live':'dot'}></span>{healthy?'Sistema operativo':`${health.length} punto(s) de atención`}</Link></header>

    <section className={`ops-health ${healthy?'healthy':'attention'}`}><div><span className="ops-label">Salud operativa</span><h2>{healthy?'Todo funciona con normalidad':'Hay elementos que requieren atención'}</h2><p>{healthy?`0 incidencias activas · ${d.health?.active_batches||0} Batch activos · fuentes disponibles`:'Sólo mostramos anomalías actuales; los errores históricos siguen en el detalle técnico.'}</p></div>{!healthy&&<div className="ops-health-items">{health.map((x,i)=><article key={`${x.title}-${i}`} className={x.tone}><strong>{x.title}</strong><span>{x.text}</span></article>)}</div>}</section>

    <section className="ops-search-panel"><form method="get" className="ops-search"><div><span className="ops-label">Búsqueda técnica</span><h2>Encuentra casi cualquier cosa</h2></div><div className="ops-search-row"><input name="q" defaultValue={p.q||''} placeholder="IMDb ID, run_id, proceso, título, persona, error, fuente…" autoComplete="off"/><button>Buscar</button></div><details className="ops-advanced"><summary>Filtros avanzados</summary><div className="ops-filters"><select name="status" defaultValue={p.status||''}><option value="">Todos los estados</option><option value="queued">En cola</option><option value="running">En curso</option><option value="succeeded">Correctos</option><option value="failed">Fallidos</option><option value="partial">Parciales</option><option value="cancelled">Cancelados</option></select><select name="kind" defaultValue={p.kind||''}><option value="">Todos los tipos</option><option value="individual">Individual</option><option value="batch">Batch</option><option value="system">Sistema</option></select><input name="process" defaultValue={p.process||''} placeholder="Proceso"/><input name="entity" defaultValue={p.entity||''} placeholder="Entidad"/><input name="source" defaultValue={p.source||''} placeholder="Fuente"/><select name="period" defaultValue={p.period||'30d'}><option value="24h">24 horas</option><option value="7d">7 días</option><option value="30d">30 días</option></select></div></details></form>
      {d.query&&<div className="ops-search-results"><div className="ops-panel-head"><div><span className="ops-label">Resultados</span><h2>{d.searchResults.length} coincidencia(s) para “{d.query}”</h2></div><Link className="ops-refresh" href="/admin">Limpiar</Link></div>{d.searchResults.length===0?<div className="ops-empty"><b>No encontramos coincidencias</b><span>Prueba con un identificador, proceso o texto técnico diferente.</span></div>:<div className="ops-runs">{d.searchResults.map(r=>{const proc=processDisplay(r.process_code);return <Link href={`/admin/runs/${r.run_id}`} className="ops-run" key={r.run_id}><div className={`ops-status-line ${tone(r.technical_status)}`}></div><div className="ops-run-main"><div className="ops-run-title"><strong>{proc.name}</strong><span className="ops-result">{r.match_reason}</span></div><p>{proc.code} · {entityDisplay(r.entity_type)}{r.entity_id?` · ${r.entity_id}`:''}</p><small>{triggerDisplay(r.trigger_source)} → {executorDisplay(r.executor)} · {dt(r.requested_at)}</small></div><div className="ops-run-meta"><span className={`ops-badge ${tone(r.technical_status)}`}>{statusLabel[r.technical_status]||r.technical_status}</span>{r.functional_result&&<b>{resultLabel[r.functional_result]||r.functional_result}</b>}<small>{duration(r.duration_ms)}</small></div></Link>})}</div>}</div>}
    </section>

    <section className="ops-panel"><div className="ops-panel-head"><div><span className="ops-label">Atención actual</span><h2>Incidencias activas</h2></div><span className="ops-coming">30 días de historial</span></div>{d.incidents.length===0?<div className="ops-empty compact"><b>Sin incidencias activas</b><span>Los fallos ya resueltos o superados por una ejecución correcta no aparecen aquí.</span></div>:<div className="ops-incident-list">{d.incidents.map((e,i)=>{const proc=processDisplay(e.process_code);return <article key={`${e.process_code}-${e.error_key}-${e.step}-${i}`}><div className="ops-incident-main"><div><strong>{proc.name}</strong><span>{e.error_key}{e.source?` · ${e.source}`:''}</span></div><p>{e.message}</p><small>{e.occurrences} ocurrencia(s) · {e.affected_entities} alcance(s) · primera {dt(e.first_seen)} · última {dt(e.last_seen)}</small></div><div className="ops-incident-actions"><Link href={`/admin/runs/${e.sample_run_id}`}>Diagnosticar</Link><form action={resolveIncidentAction}><input type="hidden" name="errorId" value={e.sample_error_id}/><input type="hidden" name="grouped" value="1"/><input type="hidden" name="processCode" value={e.process_code}/><input type="hidden" name="step" value={e.step}/><input type="hidden" name="errorKey" value={e.error_key}/><input type="hidden" name="source" value={e.source}/><button title="No borra el historial; sólo deja de requerir atención">Descartar grupo</button></form></div></article>})}</div>}</section>

    <section id="control" className="ops-control"><div className="ops-control-head"><span className="ops-label">Centro de control</span><h2>Actúa sólo donde hace falta</h2><p>Cuatro dominios claros. Los detalles internos no dominan la pantalla y las acciones delicadas siguen protegidas.</p></div><div className="ops-control-nav"><a href="#sistema">Sistema / Batch</a><a href="#fuentes">Fuentes y límites</a><a href="#recuperacion">Recuperación</a><a href="#mantenimiento">Mantenimiento</a></div>
      <div id="sistema"><OperationsBatchControl/></div>
      <div id="fuentes" className="ops-domain"><OperationsApiSources sources={apiSources}/></div>
      <div id="recuperacion" className="ops-domain"><OperationsResetTitle/></div>
      <section id="mantenimiento" className="ops-panel ops-domain"><div className="ops-panel-head"><div><span className="ops-label">Mantenimiento</span><h2>Operaciones seguras y explícitas</h2></div></div><div className="ops-maintenance"><Link href="/admin/sistema"><strong>Diagnóstico de sistema y almacenamiento</strong><span>Consulta estado técnico sin modificar datos.</span></Link><article><strong>Reconciliación automática de leases</strong><span>El worker Batch ya recupera leases vencidas mediante el mecanismo canónico; aquí se muestra como protección, no como botón indiscriminado.</span></article></div></section>
    </section>
  </div>
}
