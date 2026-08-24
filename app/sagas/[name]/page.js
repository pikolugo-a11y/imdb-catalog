import Link from 'next/link';
import {notFound} from 'next/navigation';
import {getSagaDetailV2} from '@/lib/operational-queries';
import '../sagas-modern.css';

export const dynamic='force-dynamic';
const poster=(p,w='w342')=>p?`https://image.tmdb.org/t/p/${w}${p}`:null;
const score=v=>v==null?'—':Number(v).toFixed(1);

export default async function Saga({params}){
  const{name}=await params,s=await getSagaDetailV2(name);if(!s)notFound();
  const total=s.titles.length,inPlex=s.titles.filter(x=>x.effective_status==='in_plex').length,inProcess=s.titles.filter(x=>x.effective_status==='acquiring').length,missing=total-inPlex,pct=total?Math.round(inPlex/total*100):0;
  const scored=s.titles.filter(x=>x.final_rating!=null),avg=scored.length?scored.reduce((a,x)=>a+Number(x.final_rating||0),0)/scored.length:null;
  const years=s.titles.map(x=>Number(x.year)).filter(Boolean),from=years.length?Math.min(...years):null,to=years.length?Math.max(...years):null;
  const next=s.titles.find(x=>x.effective_status!=='in_plex'&&x.imdb_id)||null;
  return <main className="sagas-modern saga-detail-modern">
    <div className="saga-breadcrumbs"><Link href="/sagas">Sagas</Link><span>›</span><b>{s.name}</b></div>

    <section className="saga-detail-hero" style={s.backdrop_path?{'--detail-bg':`url(${poster(s.backdrop_path,'w1280')})`}:undefined}><div className="saga-detail-shade"/>{poster(s.poster_path)&&<img className="saga-detail-poster" src={poster(s.poster_path)} alt=""/>}<div className="saga-detail-copy"><div className="eyebrow">Colección TMDb · PikoFilm</div><h1>{s.name}</h1><p>{total} películas{from&&to?` · ${from}–${to}`:''} · {inPlex} en tu Plex</p><div className="saga-detail-badges"><span>{pct}% completa</span>{missing===0?<span className="good">✓ Colección completa</span>:<span>{missing} por completar</span>}{inProcess>0&&<span>{inProcess} en proceso</span>}{avg!=null&&<span>Ø PikoScore {score(avg)}</span>}</div>{next&&<Link className="saga-next-cta" href={`/catalogo/${next.imdb_id}`}>Siguiente objetivo: {next.display_title||next.title} →</Link>}</div><div className="saga-detail-ring" style={{'--pct':`${pct*3.6}deg`}}><strong>{pct}%</strong><span>completitud</span></div></section>

    <section className="saga-detail-stats"><div><span>PELÍCULAS</span><strong>{total}</strong><small>En la colección</small></div><div className="good"><span>EN PLEX</span><strong>{inPlex}</strong><small>Ya disponibles</small></div><div className={missing?'warn':'good'}><span>PENDIENTES</span><strong>{missing}</strong><small>{missing?`Te faltan ${missing}`:'Nada pendiente'}</small></div><div><span>PIKOSCORE MEDIO</span><strong>{score(avg)}</strong><small>{scored.length} con valoración</small></div><div><span>PERIODO</span><strong>{from&&to?`${from}–${to}`:'—'}</strong><small>Cronología de estreno</small></div></section>

    <section className="saga-journey-head"><div><span>TU RECORRIDO</span><h2>Películas de la saga</h2></div><div className="saga-mini-progress"><b>{inPlex}/{total}</b><div><i style={{width:`${pct}%`}}/></div></div></section>

    <section className="saga-movie-grid">{s.titles.map((r,i)=>{const inCatalog=Boolean(r.imdb_id),owned=r.effective_status==='in_plex',acquiring=r.effective_status==='acquiring',state=owned?'En Plex':acquiring?'En proceso':inCatalog?'Pendiente':'Fuera del catálogo',tone=owned?'owned':acquiring?'acquiring':inCatalog?'missing':'outside',path=r.catalog_poster||r.poster_path;return <article className={`saga-movie-card ${tone}`} key={`${r.tmdb_movie_id}-${i}`}><div className="saga-order">{i+1}</div>{poster(path)?<img src={poster(path)} alt=""/>:<div className="saga-movie-empty">{i+1}</div>}<div className="saga-movie-copy"><span className={`saga-state ${tone}`}>{state}</span><h3>{r.display_title||r.title}</h3><p>{r.year||'—'}{r.final_rating!=null?` · PikoScore ${score(r.final_rating)}`:''}{r.resolution?` · ${r.resolution}`:''}</p>{inCatalog?<Link href={`/catalogo/${r.imdb_id}?from=${encodeURIComponent(`/sagas/${name}`)}`}>{owned?'Abrir ficha':'Ver película'} →</Link>:<small>Pendiente de incorporación al catálogo</small>}</div></article>})}</section>

    <section className="saga-detail-footer"><div><span>ESTADO DE LA COLECCIÓN</span><strong>{missing===0?'Completada':missing===1?'A una película de completarla':`${missing} películas pendientes`}</strong><small>Los títulos excluidos no participan en la cobertura de la saga.</small></div><Link href="/sagas">← Volver a todas las sagas</Link></section>
  </main>;
}
