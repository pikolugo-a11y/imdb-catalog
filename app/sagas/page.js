import Link from 'next/link';
import ActionButton from '@/components/ActionButton';
import {getSagasDashboard} from '@/lib/sagas-v3';
import {refreshSagasAction} from '@/app/actions';
import './sagas-modern.css';

export const dynamic='force-dynamic';
const poster=(p,w='w342')=>p?`https://image.tmdb.org/t/p/${w}${p}`:null;
const nf=n=>Number(n||0).toLocaleString('es-ES');
function qs(p,patch={}){const x=new URLSearchParams();for(const[k,v]of Object.entries({...p,...patch}))if(v!==undefined&&v!==null&&v!=='')x.set(k,String(v));return x.toString()}
const stateMeta={all:'Todas',incomplete:'En progreso',one:'A una película',complete:'Completas',not_started:'Sin empezar'};

function Kpi({p,state,label,value,help,active}){return <Link href={'/sagas?'+qs(p,{state,page:1})} className={`saga-kpi ${state} ${active?'active':''}`}><span>{label}</span><strong>{nf(value)}</strong><small>{help}</small></Link>}
function MiniSaga({r}){return <Link href={`/sagas/${r.tmdb_collection_id}`} className="saga-mini-card">{poster(r.poster_path)?<img src={poster(r.poster_path)} alt=""/>:<div className="saga-poster-empty">Saga</div>}<div><span>A UNA PELÍCULA</span><h3>{r.name_clean}</h3><p>{r.owned}/{r.total} en Plex · {Math.round(Number(r.pct)||0)}%</p>{r.saga_score!=null&&<b>★ {Number(r.saga_score).toFixed(2)} <small>{r.scored_count}/{r.total} valoradas</small></b>}</div></Link>}
function SagaCard({r}){const pct=Math.round(Number(r.pct)||0),complete=Number(r.missing)===0,notStarted=Number(r.owned)===0,one=Number(r.missing)===1;const tone=complete?'complete':notStarted?'pending':one?'almost':'progress';const status=complete?'Completa':notStarted?'Sin empezar':one?'Falta 1':'En progreso';return <Link className={`saga-modern-card ${tone}`} href={`/sagas/${r.tmdb_collection_id}`} style={r.backdrop_path?{'--saga-bg':`url(${poster(r.backdrop_path,'w780')})`}:undefined}><div className="saga-card-overlay"/><div className="saga-card-top"><div><span className={`saga-state ${tone}`}>{status}</span><h3>{r.name_clean}</h3></div>{r.saga_score!=null&&<div className="saga-score-badge"><span>PikoScore</span><strong>{Number(r.saga_score).toFixed(2)}</strong><small>{r.scored_count}/{r.total}</small></div>}</div><div className="saga-card-visual">{poster(r.poster_path)?<img src={poster(r.poster_path)} alt=""/>:<div className="saga-poster-empty">Saga</div>}<div className="saga-progress-ring" style={{'--pct':`${pct*3.6}deg`}}><strong>{pct}%</strong><span>completa</span></div></div><div className="saga-progress-line"><i style={{width:`${pct}%`}}/></div><div className="saga-card-metrics"><div><strong>{r.owned}/{r.total}</strong><span>En Plex</span></div><div><strong>{r.missing}</strong><span>Faltan</span></div><div><strong>{r.first_year||'—'}{r.last_year&&r.last_year!==r.first_year?`–${r.last_year}`:''}</strong><span>Periodo</span></div></div><div className="saga-card-cta"><span>{complete?'Colección completa':one?'A una película de completarla':notStarted?'Todavía sin empezar':`${r.missing} películas pendientes`}</span><b>Ver colección →</b></div></Link>}
function Pager({p,page,pages}){if(pages<=1)return null;return <div className="saga-pager"><Link className={page<=1?'disabled':''} href={'/sagas?'+qs(p,{page:Math.max(1,page-1)})}>← Anterior</Link><span>Página <b>{page}</b> de <b>{pages}</b></span><Link className={page>=pages?'disabled':''} href={'/sagas?'+qs(p,{page:Math.min(pages,page+1)})}>Siguiente →</Link></div>}

export default async function Sagas({searchParams}){
  const p=await searchParams,state=p.state||'all',sort=p.sort||'easy',q=p.q||'',page=Math.max(1,Number(p.page)||1);
  const data=await getSagasDashboard({q,state,sort,page,pageSize:48});
  const s=data.stats,globalPct=s.movies?Math.round(100*s.owned_movies/s.movies):0;
  return <main className="sagas-modern">
    <header className="sagas-hero"><div><div className="eyebrow">Colecciones · Plex · PikoFilm</div><h1>Sagas y colecciones</h1><p>{nf(s.all)} sagas · {nf(s.movies)} películas · {nf(s.owned_movies)} en Plex · {nf(s.missing_movies)} pendientes.</p></div><ActionButton action={refreshSagasAction} label="↻ Actualizar sagas" pendingLabel="Actualizando…"/></header>

    <section className="saga-summary"><div className="saga-overview-ring" style={{'--pct':`${globalPct*3.6}deg`}}><strong>{globalPct}%</strong></div><div><span>COBERTURA GLOBAL</span><strong>{nf(s.owned_movies)} <i>de {nf(s.movies)}</i></strong><small>Películas de sagas disponibles en Plex</small></div><div className="saga-summary-stat"><b>{nf(s.missing_movies)}</b><span>pendientes</span></div></section>

    <section className="saga-kpis"><Kpi p={p} state="all" label="Todas" value={s.all} help="Colecciones activas" active={state==='all'}/><Kpi p={p} state="incomplete" label="En progreso" value={s.incomplete} help="Ya has empezado" active={state==='incomplete'}/><Kpi p={p} state="one" label="A una película" value={s.one} help="Casi completas" active={state==='one'}/><Kpi p={p} state="complete" label="Completas" value={s.complete} help="Colecciones cerradas" active={state==='complete'}/><Kpi p={p} state="not_started" label="Sin empezar" value={s.not_started} help="0 películas en Plex" active={state==='not_started'}/></section>

    {data.almost.length>0&&<section className="saga-almost"><div className="saga-section-head"><div><span>PRÓXIMAS VICTORIAS</span><h2>A una película de completar</h2></div><Link href="/sagas?state=one">Ver todas →</Link></div><div className="saga-mini-strip">{data.almost.slice(0,5).map(r=><MiniSaga key={r.tmdb_collection_id} r={r}/>)}</div></section>}

    <section className="saga-controls"><nav>{Object.entries(stateMeta).map(([k,label])=><Link key={k} className={state===k?'active':''} href={'/sagas?'+qs(p,{state:k,page:1})}>{label}</Link>)}</nav><form method="get"><input type="hidden" name="state" value={state}/><input name="q" defaultValue={q} placeholder="Buscar saga…"/><select name="sort" defaultValue={sort}><option value="easy">Más fácil de completar</option><option value="pct">Mayor cobertura</option><option value="score">Mejor PikoScore</option><option value="missing_desc">Más faltantes</option><option value="name">Nombre</option></select><button>Aplicar</button>{(q||state!=='all'||sort!=='easy')&&<Link href="/sagas">Limpiar</Link>}</form></section>

    <div className="saga-section-head"><div><span>{stateMeta[state]||'Sagas'}</span><h2>{nf(data.total)} colecciones</h2></div><small>48 por página</small></div>
    {data.rows.length===0?<div className="saga-empty"><b>No hay sagas en esta vista</b><p>Prueba otros filtros.</p></div>:<section className="saga-modern-grid">{data.rows.map(r=><SagaCard key={r.tmdb_collection_id} r={r}/>)}</section>}
    <Pager p={{state,sort,q}} page={data.page} pages={data.pages}/>
  </main>;
}
