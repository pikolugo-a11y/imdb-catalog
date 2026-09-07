import Link from '@/components/NoPrefetchLink';
import ActionButton from '@/components/ActionButton';
import {getSagasDashboard} from '@/lib/sagas-v3';
import {getSagaFullRefreshState} from '@/lib/saga-batch';
import {refreshAllSagasAction,pauseSagaFullRefreshAction,resumeSagaFullRefreshAction,cancelSagaFullRefreshAction} from '@/app/sagas/refresh-actions';
import './sagas-v4.css';

export const dynamic='force-dynamic';
const poster=(p,w='w185')=>p?`https://image.tmdb.org/t/p/${w}${p}`:null;
const nf=n=>Number(n||0).toLocaleString('es-ES');
function qs(p,patch={}){const x=new URLSearchParams();for(const[k,v]of Object.entries({...p,...patch}))if(v!==undefined&&v!==null&&v!=='')x.set(k,String(v));return x.toString()}
const stateMeta={all:'Todas',one:'A una película',partial:'Parciales',complete:'Completas',no_plex:'Sin Plex'};

function statusOf(r){
  if(Number(r.actionable_total)>0&&Number(r.missing)===0)return{label:'Completa en Plex',tone:'complete'};
  if(Number(r.owned)>0&&Number(r.missing)===1)return{label:'Falta 1',tone:'almost'};
  if(Number(r.owned)>0)return{label:'Parcial en Plex',tone:'partial'};
  return{label:'Sin Plex',tone:'empty'};
}
function Pager({p,page,pages}){if(pages<=1)return null;return <div className="sv4-pager"><Link className={page<=1?'disabled':''} href={'/sagas?'+qs(p,{page:Math.max(1,page-1)})}>← Anterior</Link><span>Página <b>{page}</b> de <b>{pages}</b></span><Link className={page>=pages?'disabled':''} href={'/sagas?'+qs(p,{page:Math.min(pages,page+1)})}>Siguiente →</Link></div>}

export default async function Sagas({searchParams}){
  const p=await searchParams,state=p.state||'all',sort=p.sort||'priority',q=p.q||'',page=Math.max(1,Number(p.page)||1);
  const[data,batch]=await Promise.all([getSagasDashboard({q,state,sort,page,pageSize:50}),getSagaFullRefreshState()]);
  const s=data.stats,run=batch.active,c=batch.counts,enginePaused=batch.engine?.desired_state==='paused',locallyPaused=run?.desired_state==='paused',effectivePaused=enginePaused||locallyPaused;
  const processed=c?Number(c.succeeded||0)+Number(c.failed||0)+Number(c.cancelled||0):0,batchPct=c?.total?Math.round(100*processed/Number(c.total)):0;
  return <main className="sv4">
    <header className="sv4-hero">
      <div><span className="sv4-eyebrow">PikoFilm · Colecciones cinematográficas</span><h1>Sagas</h1><p>Qué colecciones tienes físicamente en Plex, cuáles están casi completas y qué títulos quedan fuera de PikoFilm o todavía no son exigibles.</p></div>
      {!run&&<ActionButton action={refreshAllSagasAction} label="↻ Actualizar todas las sagas" pendingLabel="Preparando actualización…"/>}
    </header>

    {run&&<section className="sv4-batch"><div><span>ACTUALIZACIÓN GLOBAL</span><strong>{batchPct}% · {processed}/{Number(c?.total||0)}</strong><small>{effectivePaused?(enginePaused?'Motor global pausado':'Pausada manualmente'):`${Number(c?.active||0)} activas · ${Number(c?.queued||0)} en cola`} · {Number(c?.failed||0)} fallidas</small></div><div className="sv4-batch-actions">{!enginePaused&&(locallyPaused?<ActionButton action={resumeSagaFullRefreshAction} fields={{runId:run.run_id}} label="Reanudar" pendingLabel="Reanudando…"/>:<ActionButton action={pauseSagaFullRefreshAction} fields={{runId:run.run_id}} label="Pausar" pendingLabel="Pausando…"/>)}<ActionButton action={cancelSagaFullRefreshAction} fields={{runId:run.run_id}} label="Cancelar actualización" pendingLabel="Cancelando…"/>{enginePaused&&<Link href="/admin">Abrir Operaciones →</Link>}</div></section>}

    <section className="sv4-kpis">
      <Link href="/sagas?state=one"><span>A una película</span><strong>{nf(s.one)}</strong><small>máxima prioridad</small></Link>
      <Link href="/sagas?state=partial"><span>Parciales</span><strong>{nf(s.partial)}</strong><small>presencia física incompleta</small></Link>
      <Link href="/sagas?state=complete"><span>Completas</span><strong>{nf(s.complete)}</strong><small>todo lo exigible en Plex</small></Link>
      <Link href="/sagas?state=no_plex"><span>Sin Plex</span><strong>{nf(s.no_plex)}</strong><small>ningún título exigible</small></Link>
      <div><span>No exigibles</span><strong>{nf(s.cinema+s.upcoming)}</strong><small>{nf(s.cinema)} en cines · {nf(s.upcoming)} próximas</small></div>
      <div><span>Fuera de PikoFilm</span><strong>{nf(s.outside_catalog)}</strong><small>descubrimiento, no penalizan</small></div>
    </section>

    <section className="sv4-toolbar">
      <nav>{Object.entries(stateMeta).map(([k,label])=><Link key={k} className={state===k?'active':''} href={'/sagas?'+qs(p,{state:k,page:1})}>{label}</Link>)}</nav>
      <form method="get"><input type="hidden" name="state" value={state}/><input name="q" defaultValue={q} placeholder="Buscar saga…"/><select name="sort" defaultValue={sort}><option value="priority">Prioridad de colección</option><option value="score">Mejor PikoScore</option><option value="pct">Mayor presencia Plex</option><option value="missing">Menos títulos pendientes</option><option value="name">Nombre</option></select><button>Aplicar</button>{(q||state!=='all'||sort!=='priority')&&<Link href="/sagas">Limpiar</Link>}</form>
    </section>

    <section className="sv4-table-wrap">
      <div className="sv4-section-head"><div><span>{stateMeta[state]||'Sagas'}</span><h2>{nf(data.total)} colecciones</h2></div><small>50 por página · orden predeterminado: casi completas → parciales → completas → sin Plex</small></div>
      {data.rows.length===0?<div className="sv4-empty">No hay sagas con estos filtros.</div>:<>
        <table className="sv4-table"><thead><tr><th>Saga</th><th>Estado</th><th>En Plex</th><th>Faltan</th><th>PikoScore</th><th>Disponibilidad</th><th>Fuera PikoFilm</th><th>Periodo</th><th></th></tr></thead><tbody>{data.rows.map(r=>{const st=statusOf(r);return <tr key={r.tmdb_collection_id}><td><Link className="sv4-title" href={`/sagas/${r.tmdb_collection_id}`}>{poster(r.poster_path)?<img src={poster(r.poster_path)} alt=""/>:<span className="sv4-poster-empty">S</span>}<span><b>{r.name_clean}</b><small>{r.catalog_total} en PikoFilm · {r.total} en TMDb</small></span></Link></td><td><span className={`sv4-state ${st.tone}`}>{st.label}</span></td><td><b>{r.owned}/{r.actionable_total}</b></td><td>{Number(r.missing)||'—'}</td><td>{r.saga_score!=null?<b className="sv4-score">{Number(r.saga_score).toFixed(2)}</b>:'—'}</td><td><span className="sv4-muted">{Number(r.cinema_count)?`${r.cinema_count} en cines`:''}{Number(r.cinema_count)&&Number(r.upcoming_count)?' · ':''}{Number(r.upcoming_count)?`${r.upcoming_count} próximas`:''}{!Number(r.cinema_count)&&!Number(r.upcoming_count)?'Todo exigible':' '}</span></td><td>{Number(r.outside_catalog)||'—'}</td><td>{r.first_year||'—'}{r.last_year&&r.last_year!==r.first_year?`–${r.last_year}`:''}</td><td><Link className="sv4-open" href={`/sagas/${r.tmdb_collection_id}`}>Abrir →</Link></td></tr>})}</tbody></table>
        <div className="sv4-mobile-list">{data.rows.map(r=>{const st=statusOf(r);return <Link href={`/sagas/${r.tmdb_collection_id}`} key={r.tmdb_collection_id}><div><b>{r.name_clean}</b><span className={`sv4-state ${st.tone}`}>{st.label}</span></div><p>{r.owned}/{r.actionable_total} en Plex · {r.missing} faltan · PikoScore {r.saga_score!=null?Number(r.saga_score).toFixed(2):'—'}</p><small>{r.cinema_count} en cines · {r.upcoming_count} próximas · {r.outside_catalog} fuera de PikoFilm</small></Link>})}</div>
      </>}
    </section>
    <Pager p={{state,sort,q}} page={data.page} pages={data.pages}/>
  </main>;
}
