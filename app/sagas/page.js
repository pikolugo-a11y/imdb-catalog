import Link from 'next/link';
import ActionButton from '@/components/ActionButton';
import {getSagasV2} from '@/lib/operational-queries';
import {getSagaPikoScores} from '@/lib/saga-metrics';
import {refreshSagasAction} from '@/app/actions';
import './sagas-modern.css';

export const dynamic='force-dynamic';
const poster=(p,w='w342')=>p?`https://image.tmdb.org/t/p/${w}${p}`:null;
const nf=n=>Number(n||0).toLocaleString('es-ES');
function qs(p,patch={}){const x=new URLSearchParams();for(const[k,v]of Object.entries({...p,...patch}))if(v!==undefined&&v!==null&&v!=='')x.set(k,String(v));return x.toString()}
const stateMeta={incomplete:{label:'En progreso',tone:'progress'},one:{label:'A una película',tone:'almost'},complete:{label:'Completa',tone:'complete'},not_started:{label:'Sin empezar',tone:'pending'},all:{label:'Todas',tone:'all'}};

function Kpi({href,label,value,help,tone,active}){return <Link href={href} className={`saga-kpi ${tone||''} ${active?'active':''}`}><span>{label}</span><strong>{nf(value)}</strong><small>{help}</small></Link>}
function SagaCard({r,sagaScore}){const pct=Math.round(Number(r.pct)||0),complete=Number(r.missing)===0,notStarted=Number(r.owned)===0,one=Number(r.missing)===1;const status=complete?'Completa':notStarted?'Sin empezar':one?'Falta 1':'En progreso';const tone=complete?'complete':notStarted?'pending':one?'almost':'progress';return <Link className={`saga-modern-card ${tone}`} href={`/sagas/${r.tmdb_collection_id}`} style={r.backdrop_path?{'--saga-bg':`url(${poster(r.backdrop_path,'w780')})`}:undefined}><div className="saga-card-overlay"/><div className="saga-card-top"><div><span className={`saga-state ${tone}`}>{status}</span><h3>{r.name}</h3></div><b className="saga-priority" title="Prioridad de completado">{Number(r.completion_score||0).toFixed(0)}</b></div><div className="saga-card-visual">{poster(r.poster_path)?<img src={poster(r.poster_path)} alt=""/>:<div className="saga-poster-empty">Saga</div>}<div className="saga-progress-ring" style={{'--pct':`${pct*3.6}deg`}}><strong>{pct}%</strong><span>completa</span></div></div><div className="saga-progress-line"><i style={{width:`${pct}%`}}/></div><div className="saga-card-metrics"><div><strong>{r.owned}/{r.total}</strong><span>En Plex</span></div><div><strong>{r.missing}</strong><span>Faltan</span></div><div><strong>{pct}%</strong><span>Cobertura</span></div><div className="saga-score-metric"><strong>{sagaScore?.score!=null?sagaScore.score.toFixed(2):'—'}</strong><span>PikoScore{ sagaScore?.count?` · ${sagaScore.count}/${r.total}`:''}</span></div></div><div className="saga-card-cta"><span>{complete?'Colección completa':one?'Estás a una película de completarla':notStarted?'Todavía no has empezado esta saga':`Te faltan ${r.missing} películas`}</span><b>Ver colección →</b></div></Link>}

export default async function Sagas({searchParams}){
  const p=await searchParams,state=p.state||'incomplete',sort=p.sort||'easy';
  const base={q:p.q||''};
  const [rows,allRows,incompleteRows,oneRows,completeRows,notStartedRows,sagaScores]=await Promise.all([
    getSagasV2({...p,state,sort}),getSagasV2({...base,state:'all',sort:'name'}),getSagasV2({...base,state:'incomplete',sort:'easy'}),getSagasV2({...base,state:'one',sort:'easy'}),getSagasV2({...base,state:'complete',sort:'name'}),getSagasV2({...base,state:'not_started',sort:'name'}),getSagaPikoScores()
  ]);
  const scoreFor=r=>sagaScores.get(String(r.tmdb_collection_id))||null;
  const totalMovies=allRows.reduce((a,r)=>a+Number(r.total||0),0),ownedMovies=allRows.reduce((a,r)=>a+Number(r.owned||0),0),missingMovies=allRows.reduce((a,r)=>a+Number(r.missing||0),0),globalPct=totalMovies?Math.round(100*ownedMovies/totalMovies):0;
  const spotlight=oneRows[0]||incompleteRows[0]||null,spotlightScore=spotlight?scoreFor(spotlight):null;
  const tabs=['all','incomplete','one','complete','not_started'];
  return <main className="sagas-modern">
    <header className="sagas-hero"><div><div className="eyebrow">Colecciones · Plex · PikoFilm</div><h1>Sagas y colecciones</h1><p>Tu mapa de franquicias: qué tienes, qué te falta y cuál merece ser la próxima en completar.</p></div><ActionButton action={refreshSagasAction} label="↻ Actualizar sagas" pendingLabel="Actualizando colecciones…"/></header>

    <section className="saga-kpis"><Kpi href={'/sagas?'+qs(p,{state:'all'})} label="Sagas detectadas" value={allRows.length} help="Colecciones activas" tone="all" active={state==='all'}/><Kpi href={'/sagas?'+qs(p,{state:'incomplete'})} label="En progreso" value={incompleteRows.length} help="Ya has empezado" tone="progress" active={state==='incomplete'}/><Kpi href={'/sagas?'+qs(p,{state:'one'})} label="A una película" value={oneRows.length} help="Las más fáciles" tone="almost" active={state==='one'}/><Kpi href={'/sagas?'+qs(p,{state:'complete'})} label="Completas" value={completeRows.length} help="Colecciones cerradas" tone="complete" active={state==='complete'}/><Kpi href={'/sagas?'+qs(p,{state:'not_started'})} label="Sin empezar" value={notStartedRows.length} help="Todavía 0 en Plex" tone="pending" active={state==='not_started'}/></section>

    {spotlight&&<section className="saga-spotlight" style={spotlight.backdrop_path?{'--spot-bg':`url(${poster(spotlight.backdrop_path,'w1280')})`}:undefined}><div className="spotlight-copy"><span>RECOMENDACIÓN PARA COMPLETAR</span><h2>{spotlight.name}</h2><p>{spotlight.missing===1?'Solo te falta una película para cerrar esta colección.':`Ya tienes ${spotlight.owned} de ${spotlight.total}; es una de las colecciones más cercanas a completar.`}</p><div><b>{spotlight.owned}/{spotlight.total} en Plex</b><b>{Math.round(Number(spotlight.pct)||0)}% completa</b>{spotlightScore?.score!=null&&<b>PikoScore saga {spotlightScore.score.toFixed(2)} · {spotlightScore.count}/{spotlight.total}</b>}<b>Prioridad {Number(spotlight.completion_score||0).toFixed(0)}</b></div><Link href={`/sagas/${spotlight.tmdb_collection_id}`}>Abrir colección →</Link></div>{poster(spotlight.poster_path)&&<img src={poster(spotlight.poster_path)} alt=""/>}</section>}

    <section className="saga-overview"><div className="saga-overview-ring" style={{'--pct':`${globalPct*3.6}deg`}}><strong>{globalPct}%</strong><span>cobertura global</span></div><div><span>PELÍCULAS DE SAGAS</span><strong>{nf(ownedMovies)} en Plex <i>de {nf(totalMovies)}</i></strong><small>{nf(missingMovies)} pendientes dentro de colecciones · los títulos excluidos no cuentan</small></div></section>

    <section className="saga-controls"><nav>{tabs.map(k=><Link key={k} className={state===k?'active':''} href={'/sagas?'+qs(p,{state:k,page:undefined})}>{stateMeta[k].label}</Link>)}</nav><form method="get"><input type="hidden" name="state" value={state}/><input name="q" defaultValue={p.q||''} placeholder="Buscar saga…"/><select name="sort" defaultValue={sort}><option value="easy">Más fácil de completar</option><option value="pct">Mayor porcentaje</option><option value="score">Mejor prioridad</option><option value="missing_desc">Más faltantes</option><option value="name">Nombre</option></select><button>Aplicar</button><Link href="/sagas">Limpiar</Link></form></section>

    <div className="saga-section-head"><div><span>{stateMeta[state]?.label||'Sagas'}</span><h2>{rows.length} colecciones</h2></div><small>Ordenadas por {sort==='easy'?'facilidad de completado':sort==='pct'?'cobertura':sort==='score'?'prioridad':sort==='missing_desc'?'faltantes':'nombre'}</small></div>
    {rows.length===0?<div className="saga-empty"><b>No hay sagas en esta vista</b><p>Prueba otro estado o actualiza las colecciones.</p></div>:<section className="saga-modern-grid">{rows.map(r=><SagaCard key={r.tmdb_collection_id} r={r} sagaScore={scoreFor(r)}/>)}</section>}
  </main>;
}
