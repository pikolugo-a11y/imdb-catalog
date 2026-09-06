import Link from 'next/link';
import {notFound} from 'next/navigation';
import {getCatalogItem,getSeriesDetail,getSagaDetail} from '@/lib/queries';
import {getCatalogRatings} from '@/lib/catalog-ratings';
import {getSeriesDashboard} from '@/lib/series-dashboard';
import {getMovieDetailExtras} from '@/lib/movie-detail-extras';
import ExcludeTitleForm from './ExcludeTitleForm';
import './ficha-v4.css';

export const dynamic='force-dynamic';

const img=p=>p?`https://image.tmdb.org/t/p/w342${p}`:null;
const isSeries=t=>t==='Serie'||t==='Miniserie';
const cleanTitle=t=>String(t||'').replace(/\s*\((?:Serie de TV|TV Series)\)\s*$/i,'');
const fmt=v=>v==null?'—':Number(v).toFixed(1);
const fmt2=v=>v==null?'—':Number(v).toFixed(2);
const votes=v=>v==null?'—':Number(v).toLocaleString('es-ES');
const date=v=>{if(!v)return '—';const d=new Date(v);return Number.isNaN(d.getTime())?'—':d.toLocaleDateString('es-ES')};
const runtime=v=>{const x=Number(v);if(!Number.isFinite(x)||x<=0)return '—';const h=Math.floor(x/60),m=x%60;return h?`${h} h${m?` ${m} min`:''}`:`${m} min`};
const bitrate=v=>{const x=Number(v);if(!Number.isFinite(x)||x<=0)return '—';return x>=1000?`${(x/1000).toFixed(1)} Mbps`:`${x} Kbps`};
const size=v=>{const x=Number(v);if(!Number.isFinite(x)||x<=0)return '—';return `${(x/1073741824).toFixed(1)} GB`};
const qBand=b=>({excellent:'Excelente',very_good:'Muy buena',correct:'Correcta',improvable:'Mejorable',deficient:'Mala'}[b]||'—');
const qClass=b=>b==='excellent'||b==='very_good'?'good':b==='correct'?'mid':b==='improvable'?'warn':'bad';
const sourceLabel=s=>({imdb:'IMDb',tmdb:'TMDb',trakt:'Trakt',letterboxd:'Letterboxd',rt_audience:'RT audiencia',rt_critics:'RT críticos',metacritic:'Metacritic',metacritic_user:'MC usuarios',roger_ebert:'Roger Ebert'}[s]||s);
const familyLabel=f=>({audience:'Audiencia',cinephile:'Cinéfilos',critics:'Crítica'}[f]||f);
const attentionLabel=t=>({duration:'Duración sospechosa',filename:'Nombre de archivo sospechoso',duplicate:'Varias versiones asociadas'}[t]||'Revisión de la copia física');
const crewRelevant=xs=>(xs||[]).filter(c=>{const j=String(c.job||'').toLowerCase();return /director|creator|created by|creador|showrunner/.test(j)}).slice(0,6);
const safeBack=v=>{const s=String(v||'');return s.startsWith('/catalogo')&&!s.startsWith('//')?s:'/catalogo'};

function PlexBadge({inPlex}){return <span className={`fv4-plex ${inPlex?'in':'out'}`}><i aria-hidden="true"/>{inPlex?'En Plex':'Sin Plex'}</span>}

function ScoreHero({ratingsData}){
  const ratings=ratingsData?.ratings||[],families=ratingsData?.contributions||[],confidence=ratingsData?.confidence==null?null:Number(ratingsData.confidence),ready=ratingsData?.score!=null;
  return <section className="fv4-score-block">
    <div className="fv4-score-main"><span>★ PikoScore</span><strong>{ready?fmt2(ratingsData.score):'—'}</strong><small>{ready?'Valoración PikoFilm':'Sin cálculo vigente'}</small></div>
    <div className="fv4-score-context">
      <div className="fv4-score-meta"><span>Confianza <b>{confidence==null?'—':`${confidence.toFixed(0)}%`}</b></span><span><b>{ratingsData?.sourceCount||ratings.length}</b> fuentes</span><span><b>{ratingsData?.familyCount||families.length}</b> familias</span></div>
      {confidence!=null&&<div className="fv4-confidence"><i style={{width:`${Math.max(0,Math.min(100,confidence))}%`}}/></div>}
      {families.length>0&&<div className="fv4-families">{families.map(f=><span key={f.family}><b>{familyLabel(f.family)}</b>{fmt(f.score)}</span>)}</div>}
      {ratingsData?.calculatedAt&&<small>Calculado {date(ratingsData.calculatedAt)}</small>}
    </div>
  </section>;
}

function ExternalRatings({ratingsData}){
  const ratings=ratingsData?.ratings||[];
  if(!ratings.length)return null;
  return <section className="fv4-secondary-panel fv4-ratings"><div className="fv4-section-head"><div><span>Contexto externo</span><h2>Valoraciones de origen</h2></div>{ratingsData?.refreshedAt&&<small>Actualizadas {date(ratingsData.refreshedAt)}</small>}</div><div className="fv4-rating-strip">{ratings.map(r=><article key={r.source}><span>{sourceLabel(r.source)}</span><b>{fmt(r.normalized_rating)}</b><small>{r.votes==null?'Sin volumen publicado':`${votes(r.votes)} votos/reseñas`}</small></article>)}</div></section>;
}

function Credits({item,series=false}){
  const credits=item.credits||[],cast=credits.filter(c=>c.credit_type==='cast').slice(0,series?8:10),crew=crewRelevant(credits.filter(c=>c.credit_type!=='cast'));
  return <div className="fv4-credit-layout">
    {crew.length>0&&<section className="fv4-secondary-panel"><div className="fv4-section-head"><div><span>{series?'Creación y dirección':'Dirección'}</span><h2>Equipo principal</h2></div></div><div className="fv4-crew-list">{crew.map((c,i)=><Link href={c.tmdb_person_id?`/personas/${c.tmdb_person_id}`:'#'} key={`${c.tmdb_person_id||c.name}-${i}`}><b>{c.name}</b><span>{c.job||'Equipo principal'}</span></Link>)}</div></section>}
    <section className="fv4-secondary-panel"><div className="fv4-section-head"><div><span>Personas</span><h2>Reparto principal</h2></div></div>{cast.length?<div className="fv4-cast">{cast.map((c,i)=><Link href={c.tmdb_person_id?`/personas/${c.tmdb_person_id}`:'#'} key={`${c.tmdb_person_id||c.name}-${i}`} className="fv4-person">{img(c.profile_path)?<img src={img(c.profile_path)} alt=""/>:<div className="fv4-person-ph"/>}<span><b>{c.name}</b><small>{c.character_name||'Reparto'}</small></span></Link>)}</div>:<p className="fv4-muted">Sin reparto enriquecido disponible.</p>}</section>
  </div>;
}

function SourceLinks({item,plexId,series=false}){
  return <section className="fv4-sourcebar"><div><span>Identificadores</span><nav>{item.imdb_id&&<a href={`https://www.imdb.com/title/${item.imdb_id}/`} target="_blank" rel="noreferrer"><b>IMDb</b>{item.imdb_id} ↗</a>}{item.tmdb_id&&<a href={`https://www.themoviedb.org/${series?'tv':'movie'}/${item.tmdb_id}`} target="_blank" rel="noreferrer"><b>TMDb</b>{item.tmdb_id} ↗</a>}{plexId&&<span><b>Plex</b>{plexId}</span>}</nav></div></section>;
}

function MovieDetail({item,back,ratingsData,qualityData,saga}){
  const inPlex=item.effective_status==='in_plex',director=crewRelevant((item.credits||[]).filter(c=>c.credit_type!=='cast'))[0]||null,qualityReady=qualityData?.score!=null,sagaTitles=saga?.titles||[],inCatalog=sagaTitles.filter(x=>Boolean(x.display_title)).length,inPlexSaga=sagaTitles.filter(x=>x.effective_status==='in_plex').length;
  const attentionHref=qualityData?.attention_id?`/calidad/peliculas?type=${encodeURIComponent(qualityData.attention_type||'')}&q=${encodeURIComponent(qualityData.plex_title||item.display_title||'')}`:null;
  return <main className="ficha-v4">
    <div className="fv4-back"><Link href={back}>← Volver</Link><span>Película</span></div>
    <section className="fv4-hero">
      <div className="fv4-poster-wrap">{item.poster_path?<img src={img(item.poster_path)} alt=""/>:<div className="fv4-poster-ph"/>}</div>
      <div className="fv4-identity"><div className="fv4-kicker"><span>Película</span><PlexBadge inPlex={inPlex}/>{qualityReady&&<span className={`fv4-quality-chip ${qClass(qualityData.band)}`}>PikoQuality {Math.round(Number(qualityData.score))}</span>}</div><h1>{item.display_title}</h1>{item.original_title&&item.original_title!==item.display_title&&<p className="fv4-original">{item.original_title}</p>}<div className="fv4-genres">{(item.genres||[]).slice(0,5).map(g=><span key={g}>{g}</span>)}</div><div className="fv4-facts"><span><b>Año</b>{item.year||'—'}</span><span><b>Duración</b>{runtime(item.runtime)}</span><span><b>País</b>{item.country||'—'}</span><span><b>Estreno</b>{date(item.release_date)}</span></div>{director&&<Link className="fv4-lead-credit" href={director.tmdb_person_id?`/personas/${director.tmdb_person_id}`:'#'}><span>{director.job||'Dirección'}</span><b>{director.name}</b></Link>}{item.tagline&&<p className="fv4-tagline">{item.tagline}</p>}<div className="fv4-synopsis"><span>Sinopsis</span><p>{item.overview||'Sin sinopsis enriquecida disponible.'}</p></div></div>
      <ScoreHero ratingsData={ratingsData}/>
    </section>

    <section className="fv4-status-row"><article><span>Plex</span><b>{inPlex?'Disponible físicamente':'Sin Plex'}</b><small>{inPlex?'Presencia confirmada en tu biblioteca':'Estado neutral de colección'}</small></article><article><span>PikoQuality</span><b>{inPlex?(qualityReady?`${Math.round(Number(qualityData.score))} · ${qBand(qualityData.band)}`:'—'):'—'}</b><small>{inPlex?(qualityReady?[qualityData.resolution,qualityData.video_codec].filter(Boolean).join(' · ')||'Copia analizada':'Sin análisis vigente'):'Sólo aplica cuando existe copia física'}</small></article></section>

    {attentionHref&&<section className="fv4-attention"><div><span>⚠ Requiere tu atención</span><b>{attentionLabel(qualityData.attention_type)}</b><small>Hay una decisión pendiente sobre la copia física. Los fallos técnicos y reintentos siguen perteneciendo a Operaciones.</small></div><Link href={attentionHref}>Abrir en Calidad →</Link></section>}

    {inPlex&&qualityData&&<section className="fv4-secondary-panel fv4-copy"><div className="fv4-section-head"><div><span>Copia física</span><h2>Datos técnicos</h2></div></div><div className="fv4-tech-grid"><span><b>Resolución</b>{qualityData.resolution||'—'}</span><span><b>Vídeo</b>{qualityData.video_codec||'—'}</span><span><b>Bitrate</b>{bitrate(qualityData.bitrate)}</span><span><b>Audio</b>{qualityData.audio_codec||'—'}{qualityData.audio_channels?` · ${qualityData.audio_channels} canales`:''}</span><span><b>Tamaño</b>{size(qualityData.file_size_bytes)}</span></div></section>}

    <ExternalRatings ratingsData={ratingsData}/>

    {saga&&sagaTitles.length>0&&<section className="fv4-secondary-panel fv4-saga"><div className="fv4-section-head"><div><span>Saga / colección</span><h2>{saga.name||item.collection_name}</h2><small>{inCatalog}/{sagaTitles.length} en PikoFilm · {inPlexSaga}/{sagaTitles.length} en Plex</small></div><Link href={`/sagas/${item.tmdb_collection_id}`}>Abrir saga →</Link></div><div className="fv4-saga-strip">{sagaTitles.map((x,i)=>{const current=x.imdb_id===item.imdb_id,catalogued=Boolean(x.display_title),body=<><span className="fv4-saga-index">{i+1}</span><div><b>{x.display_title||x.title}</b><small>{x.year||'—'} · {catalogued?'En PikoFilm':'Fuera de PikoFilm'} · {x.effective_status==='in_plex'?'En Plex':'Sin Plex'}</small></div></>;return catalogued&&x.imdb_id?<Link className={current?'current':''} href={`/catalogo/${x.imdb_id}`} key={`${x.imdb_id}-${i}`}>{body}</Link>:<div className={current?'current':''} key={`${x.tmdb_movie_id||x.title}-${i}`}>{body}</div>})}</div></section>}

    <Credits item={item}/>
    <SourceLinks item={item} plexId={qualityData?.rating_key}/>
    <section className="fv4-actions"><div><span>Gestión</span><p>Esta acción afecta a la pertenencia de la obra a PikoFilm.</p></div><ExcludeTitleForm imdbId={item.imdb_id} returnTo={back} label="Excluir de PikoFilm"/></section>
  </main>;
}

function SeriesDetail({item,back,operational,dashboard,ratingsData}){
  const s=item.series||{},inPlex=item.effective_status==='in_plex',episodes=operational?.episodes||[],seasonNums=[...new Set(episodes.map(e=>Number(e.season_number)).filter(x=>x>0))],qBySeason=new Map((dashboard?.seasonQuality||[]).map(x=>[Number(x.season_index),x]));
  const seasons=seasonNums.map(sn=>{const es=episodes.filter(e=>Number(e.season_number)===sn),present=es.filter(e=>e.effective_status==='present').length,total=es.length,quality=qBySeason.get(sn)||null;return{sn,present,total,complete:total>0&&present===total,quality}});
  const total=s.official_episodes||s.diagnosed||episodes.length||0,present=s.present||0,complete=total>0&&present===total,title=cleanTitle(item.display_title);
  return <main className="ficha-v4">
    <div className="fv4-back"><Link href={back}>← Volver</Link><span>{item.type}</span></div>
    <section className="fv4-hero">
      <div className="fv4-poster-wrap">{item.poster_path?<img src={img(item.poster_path)} alt=""/>:<div className="fv4-poster-ph"/>}</div>
      <div className="fv4-identity"><div className="fv4-kicker"><span>{item.type}</span><PlexBadge inPlex={inPlex}/>{dashboard?.quality?.score!=null&&<span className={`fv4-quality-chip ${qClass(dashboard.quality.band)}`}>PikoQuality {Math.round(Number(dashboard.quality.score))}</span>}</div><h1>{title}</h1>{item.original_title&&cleanTitle(item.original_title)!==title&&<p className="fv4-original">{cleanTitle(item.original_title)}</p>}<div className="fv4-genres">{(item.genres||[]).slice(0,5).map(g=><span key={g}>{g}</span>)}</div><div className="fv4-facts"><span><b>Año</b>{item.year||'—'}</span><span><b>País</b>{item.country||'—'}</span><span><b>Estreno</b>{date(item.release_date)}</span><span><b>Temporadas</b>{s.official_seasons||seasons.length||'—'}</span></div><div className="fv4-synopsis"><span>Sinopsis</span><p>{item.overview||'Sin sinopsis enriquecida disponible.'}</p></div></div>
      <ScoreHero ratingsData={ratingsData}/>
    </section>

    <section className="fv4-status-row"><article><span>Plex</span><b>{inPlex?'Disponible físicamente':'Sin Plex'}</b><small>{total?`${present}/${total} episodios presentes`:'Sin cobertura de episodios disponible'}</small></article><article><span>Integridad física</span><b>{total?(complete?'✓ Completa':'× Pendiente'):'—'}</b><small>{total?`${present}/${total} capítulos`:'Sin referencia oficial suficiente'}</small></article></section>

    {seasons.length>0&&<section className="fv4-secondary-panel fv4-seasons"><div className="fv4-section-head"><div><span>Temporadas</span><h2>Estado físico por temporada</h2><small>Presencia en Plex y calidad de la copia, sin seguimiento de visionado.</small></div></div><div className="fv4-season-strip">{seasons.map(x=><article className={x.complete?'complete':'pending'} key={x.sn}><div><b>T{x.sn}</b><span>{x.complete?'✓ Completa':'× Pendiente'}</span></div><strong>{x.present}/{x.total}</strong><small>{x.quality?.score!=null?`PikoQuality ${Math.round(Number(x.quality.score))} · ${qBand(x.quality.band)}`:'PikoQuality —'}</small></article>)}</div></section>}

    <ExternalRatings ratingsData={ratingsData}/>
    <Credits item={item} series/>
    <SourceLinks item={item} plexId={s.show_rating_key} series/>
    <section className="fv4-actions"><div><span>Gestión</span><p>Esta acción afecta a la pertenencia de la obra a PikoFilm.</p></div><ExcludeTitleForm imdbId={item.imdb_id} returnTo={back} label="Excluir de PikoFilm"/></section>
  </main>;
}

export default async function Ficha({params,searchParams}){
  const {imdbId}=await params,p=await searchParams,back=safeBack(p?.from);
  const item=await getCatalogItem(imdbId);
  if(!item)notFound();
  if(isSeries(item.type)){
    const results=await Promise.allSettled([item.series?.show_rating_key?getSeriesDetail(item.series.show_rating_key):null,item.series?.show_rating_key?getSeriesDashboard(item.series.show_rating_key):null,getCatalogRatings(imdbId)]);
    const value=i=>results[i].status==='fulfilled'?results[i].value:null;
    return <SeriesDetail item={item} back={back} operational={value(0)} dashboard={value(1)} ratingsData={value(2)}/>;
  }
  const results=await Promise.allSettled([getCatalogRatings(imdbId),getMovieDetailExtras(imdbId),item.tmdb_collection_id?getSagaDetail(item.tmdb_collection_id):null]);
  const value=i=>results[i].status==='fulfilled'?results[i].value:null;
  return <MovieDetail item={item} back={back} ratingsData={value(0)} qualityData={value(1)} saga={value(2)}/>;
}
