import Link from 'next/link';
import {notFound} from 'next/navigation';
import {getSagaDetailV3} from '@/lib/sagas-v3';
import '../sagas-modern.css';

export const dynamic='force-dynamic';
const poster=(p,w='w342')=>p?`https://image.tmdb.org/t/p/${w}${p}`:null;
const score=v=>v==null?'—':Number(v).toFixed(2);

export default async function Saga({params}){
  const{name}=await params,s=await getSagaDetailV3(name);if(!s)notFound();
  const total=s.titles.length,inPlex=s.titles.filter(x=>x.effective_status==='in_plex').length,inProcess=s.titles.filter(x=>x.effective_status==='acquiring').length,missing=total-inPlex,pct=total?Math.round(inPlex/total*100):0;
  const scored=s.titles.filter(x=>x.final_rating!=null),avg=scored.length?scored.reduce((a,x)=>a+Number(x.final_rating),0)/scored.length:null;
  const years=s.titles.map(x=>Number(x.year)).filter(Boolean),from=years.length?Math.min(...years):null,to=years.length?Math.max(...years):null;
  const next=s.titles.find(x=>x.effective_status!=='in_plex'&&x.imdb_id)||null;
  return <main className="sagas-modern saga-detail-modern">
    <div className="saga-breadcrumbs"><Link href="/sagas">Sagas</Link><span>›</span><b>{s.name_clean}</b></div>
    <section className="saga-detail-hero" style={s.backdrop_path?{'--detail-bg':`url(${poster(s.backdrop_path,'w1280')})`}:undefined}><div className="saga-detail-shade"/>{poster(s.poster_path)&&<img className="saga-detail-poster" src={poster(s.poster_path,'w342')} alt=""/>}<div className="saga-detail-copy"><div className="eyebrow">Saga · PikoFilm</div><h1>{s.name_clean}</h1><p>{total} películas{from&&to?` · ${from}–${to}`:''}</p><div className="saga-detail-badges"><span>{inPlex}/{total} en Plex</span><span>{pct}% completa</span>{missing===0?<span className="good">✓ Completa</span>:<span>{missing} pendientes</span>}{inProcess>0&&<span>{inProcess} en proceso</span>}</div>{avg!=null&&<div className="saga-hero-score"><span>PikoScore saga</span><strong>{score(avg)}</strong><small>{scored.length}/{total} valoradas</small></div>}{next&&<Link className="saga-next-cta" href={`/catalogo/${next.imdb_id}`}>Siguiente objetivo: {next.display_title||next.title} →</Link>}</div><div className="saga-detail-ring" style={{'--pct':`${pct*3.6}deg`}}><strong>{pct}%</strong><span>completitud</span></div></section>

    <section className="saga-detail-stats"><div><span>PELÍCULAS</span><strong>{total}</strong><small>En la saga</small></div><div className="good"><span>EN PLEX</span><strong>{inPlex}</strong><small>Disponibles</small></div><div className={missing?'warn':'good'}><span>PENDIENTES</span><strong>{missing}</strong><small>{inProcess?`${inProcess} en proceso`:'Por conseguir'}</small></div><div><span>PIKOSCORE SAGA</span><strong>{score(avg)}</strong><small>{scored.length}/{total} valoradas</small></div><div><span>PERIODO</span><strong>{from&&to?`${from}–${to}`:'—'}</strong><small>Estrenos</small></div></section>

    <section className="saga-journey-head"><div><span>TU COLECCIÓN</span><h2>Películas de la saga</h2></div><div className="saga-mini-progress"><b>{inPlex}/{total}</b><div><i style={{width:`${pct}%`}}/></div></div></section>
    <section className="saga-movie-grid">{s.titles.map((r,i)=>{const inCatalog=Boolean(r.imdb_id),owned=r.effective_status==='in_plex',acquiring=r.effective_status==='acquiring',state=owned?'En Plex':acquiring?'En proceso':inCatalog?'Pendiente':'Fuera del catálogo',tone=owned?'owned':acquiring?'acquiring':inCatalog?'missing':'outside',path=r.catalog_poster||r.poster_path;return <article className={`saga-movie-card ${tone}`} key={`${r.tmdb_movie_id}-${i}`}><div className="saga-order">{i+1}</div>{poster(path,'w342')?<img src={poster(path,'w342')} alt=""/>:<div className="saga-movie-empty">{i+1}</div>}<div className="saga-movie-copy"><span className={`saga-state ${tone}`}>{state}</span><h3>{r.display_title||r.title}</h3><div className="saga-movie-meta"><span>{r.year||'—'}</span>{r.resolution&&<span>{r.resolution}</span>}</div><div className="saga-movie-scores"><div><small>PikoScore</small><strong>{score(r.final_rating)}</strong></div>{r.pikoquality_score!=null&&<div><small>PikoQuality</small><strong>{Math.round(Number(r.pikoquality_score))}</strong></div>}</div>{inCatalog?<Link href={`/catalogo/${r.imdb_id}?from=${encodeURIComponent(`/sagas/${name}`)}`}>Abrir ficha →</Link>:<small>Pendiente de incorporación al catálogo</small>}</div></article>})}</section>

    <section className="saga-detail-footer"><div><span>ESTADO</span><strong>{missing===0?'Colección completada':missing===1?'A una película de completarla':`${missing} películas pendientes`}</strong><small>Los títulos excluidos no cuentan en la cobertura.</small></div><Link href="/sagas">← Volver a sagas</Link></section>
  </main>;
}
