import Link from 'next/link';
import {notFound} from 'next/navigation';
import {getCatalogItem,getSeriesDetail} from '@/lib/queries';
import {getCatalogRatings} from '@/lib/catalog-ratings';
import {getSeriesDashboard} from '@/lib/series-dashboard';
import EnrichTitleButton from '@/components/EnrichTitleButton';
import {markAcquiring,clearAcquiring,excludeTitle,saveIdentityAction} from '@/app/actions';
import './detail-editorial.css';
import './series-command.css';
import './movie-command.css';

export const dynamic='force-dynamic';

const img=p=>p?`https://image.tmdb.org/t/p/w342${p}`:null;
const isSeries=t=>t==='Serie'||t==='Miniserie';
const n=v=>v==null?'—':Number(v).toLocaleString('es-ES');
const qBand=b=>({excellent:'Excelente',very_good:'Muy buena',correct:'Correcta',improvable:'Mejorable',deficient:'Mala'}[b]||'—');
const qClass=b=>b==='excellent'||b==='very_good'?'good':b==='correct'?'mid':b==='improvable'?'warn':'bad';
const cleanSeriesTitle=t=>String(t||'').replace(/\s*\((?:Serie de TV|TV Series)\)\s*$/i,'');
const flagFor=c=>({'Estados Unidos':'🇺🇸','España':'🇪🇸','Reino Unido':'🇬🇧','Francia':'🇫🇷','Italia':'🇮🇹','Alemania':'🇩🇪','Canadá':'🇨🇦','Japón':'🇯🇵','Corea del Sur':'🇰🇷','Australia':'🇦🇺','México':'🇲🇽','Argentina':'🇦🇷','Brasil':'🇧🇷','Suecia':'🇸🇪','Noruega':'🇳🇴','Dinamarca':'🇩🇰','Finlandia':'🇫🇮','Irlanda':'🇮🇪','Bélgica':'🇧🇪','Países Bajos':'🇳🇱','Nueva Zelanda':'🇳🇿'}[c]||'🌐');
const relevantCrew=credits=>(credits||[]).filter(c=>{const j=String(c.job||'').toLowerCase();return /creator|created by|showrunner|director|director de|creador/.test(j)&&!/staff writer|writer|screenplay|novel/.test(j)}).slice(0,4);
const sourceLabel=s=>({imdb:'IMDb',tmdb:'TMDb',trakt:'Trakt',letterboxd:'Letterboxd',rt_audience:'RT audiencia',rt_critics:'RT críticos',metacritic:'Metacritic',metacritic_user:'MC usuarios',roger_ebert:'Roger Ebert'}[s]||s);
const familyLabel=f=>({audience:'Audiencia',cinephile:'Cinéfilos',critics:'Crítica'}[f]||f);
const marketLabel=m=>m==='spain'?'Mercado España':m==='global'?'Mercado global':'Mercado sin definir';
const score1=v=>v==null?'—':Number(v).toFixed(1);
const score2=v=>v==null?'—':Number(v).toFixed(2);
const dateShort=v=>v?new Date(v).toLocaleDateString('es-ES'):'—';
const runtimeLabel=v=>{const x=Number(v);if(!Number.isFinite(x)||x<=0)return '—';const h=Math.floor(x/60),m=x%60;return h?`${h} h ${m?`${m} min`:''}`:`${m} min`;};

function EditorialSeries({item,back,notice,operational,dashboard,ratingsData}){
  const cast=item.credits.filter(c=>c.credit_type==='cast').slice(0,8);
  const crew=relevantCrew(item.credits.filter(c=>c.credit_type!=='cast'));
  const s=item.series;
  const total=s?.official_episodes||s?.diagnosed||0;
  const present=s?.present||0;
  const coverage=total?Math.round(100*present/total):0;
  const episodes=operational?.episodes||[];
  const seasonNums=[...new Set(episodes.map(e=>Number(e.season_number)).filter(x=>x>0))];
  const qBySeason=new Map((dashboard?.seasonQuality||[]).map(x=>[Number(x.season_index),x]));
  const seasonCards=seasonNums.map(sn=>{const es=episodes.filter(e=>Number(e.season_number)===sn);const p=es.filter(e=>e.effective_status==='present').length;const m=es.filter(e=>e.effective_status==='missing_actionable').length;const u=es.filter(e=>e.effective_status==='availability_unknown').length;const na=es.filter(e=>e.effective_status==='not_available_es').length;return{sn,total:es.length,p,m,u,na,pct:es.length?Math.round(100*p/es.length):0,quality:qBySeason.get(sn)||null}});
  const quality=dashboard?.quality||null;
  const title=cleanSeriesTitle(item.display_title);
  const release=item.release_date?new Date(item.release_date).toLocaleDateString('es-ES'):item.year||'—';
  const hasIssue=(s?.not_available_es||0)>0||!item.imdb_id||!item.tmdb_id||!s?.show_rating_key;
  const ratings=ratingsData?.ratings||[];
  const pikoReady=ratingsData?.score!=null;
  const confidence=ratingsData?.confidence==null?null:Number(ratingsData.confidence);
  const families=ratingsData?.contributions||[];
  const pikoVersion=String(ratingsData?.version||'').replace('3.0.0-experimental.','3.0 · v');
  return <>
    <div className="editorial-crumbs"><Link href={back}>Catálogo</Link><span>›</span><span>Series</span><span>›</span><b>{title}</b></div>
    {notice==='identity_saved'&&<div className="toast success">Identificadores guardados.</div>}
    <section className="series-command series-command-v3">
      <div className="series-command-main">{item.poster_path?<img className="command-poster" src={img(item.poster_path)} alt=""/>:<div className="command-poster"/>}<div className="command-copy">
        <div className="eyebrow">{item.type} · {item.effective_status==='in_plex'?'EN PLEX':item.effective_status==='acquiring'?'EN PROCESO':'CATÁLOGO'}</div><h1>{title}</h1>
        {item.original_title&&cleanSeriesTitle(item.original_title)!==title&&<p className="editorial-original">{cleanSeriesTitle(item.original_title)}</p>}{item.tagline&&<p className="editorial-tagline">{item.tagline}</p>}
        <div className="command-facts"><span><b>Géneros</b>{(item.genres||[]).join(' · ')||'—'}</span><span><b>País</b><i>{flagFor(item.country)}</i>{item.country||'—'}</span><span><b>Estreno</b>{release}</span></div>
        {crew[0]&&<div className="hero-credit"><span>{crew[0].job||'Creador / dirección'}</span><b>{crew[0].name}</b></div>}
        <div className="hero-synopsis"><span>SINOPSIS</span><p>{item.overview||'Sin sinopsis enriquecida disponible.'}</p></div>
      </div></div>
      <div className="series-intelligence">
        <div className={`piko-console ${pikoReady?'ready':'pending'}`}>
          <div className="piko-console-score"><span>★ PikoScore</span><strong>{pikoReady?score2(ratingsData.score):'—'}</strong><small>{pikoReady?'Valoración PikoFilm':'Pendiente de cálculo'}</small></div>
          <div className="piko-console-trust">
            <div className="piko-console-head"><div><span>CONFIANZA</span><b>{confidence==null?'—':`${confidence.toFixed(1)}%`}</b></div><div className="piko-evidence"><span>{ratingsData?.sourceCount||ratings.length} fuentes</span><span>{ratingsData?.familyCount||families.length} familias</span></div></div>
            <div className="confidence-track"><i style={{width:`${Math.max(0,Math.min(100,confidence||0))}%`}}/></div>
            <div className="piko-context"><span>{marketLabel(ratingsData?.market)}</span>{pikoVersion&&<span>{pikoVersion}</span>}{ratingsData?.calculatedAt&&<span>Calculado {dateShort(ratingsData.calculatedAt)}</span>}</div>
            {families.length>0&&<div className="family-strip">{families.map(f=><div key={f.family}><span>{familyLabel(f.family)}</span><b>{score1(f.score)}</b><small>{Math.round(Number(f.weight||0)*100)}% peso</small></div>)}</div>}
          </div>
        </div>
        <div className="source-board"><div className="source-board-head"><div><span>RATINGS DISPONIBLES</span><b>{ratings.length} señales actuales</b></div>{ratingsData?.refreshedAt&&<small>Actualizados {dateShort(ratingsData.refreshedAt)}</small>}</div>{ratings.length?<div className="source-grid">{ratings.map(r=><div className={`source-chip ${r.rating_type||''}`} key={r.source}><div><span>{sourceLabel(r.source)}</span><strong>{score1(r.normalized_rating)}</strong></div><small>{r.votes==null?'Volumen no publicado':`${n(r.votes)} votos/reseñas`}</small></div>)}</div>:<div className="source-empty">Todavía no hay ratings MDBList guardados para esta serie.</div>}</div>
        <div className="series-health-row">
          <div className={`quality-summary ${quality?qClass(quality.band):'pending'}`}><span>PIKOQUALITY</span>{quality?<><strong>{quality.score}</strong><b>{qBand(quality.band)}</b><small>{quality.analyzed_count}/{quality.total_count} episodios analizados</small></>:<><strong>···</strong><b>Calculando</b><small>Pendiente de agregados</small></>}</div>
          <div className={`hero-coverage coverage-compact ${coverage===100?'good':coverage>=80?'warn':'bad'}`}><div className="hero-ring" style={{'--pct':`${coverage*3.6}deg`}}><strong>{coverage}%</strong></div><div><span>COBERTURA PLEX</span><b>{present} / {total||'—'}</b><small>{s?.missing||0} faltan · {s?.unknown||0} por confirmar</small></div></div>
        </div>
        {hasIssue&&<div className="hero-alerts">{(s?.not_available_es||0)>0&&<span>⚠ {s.not_available_es} episodios no disponibles en España</span>}{(!item.imdb_id||!item.tmdb_id||!s?.show_rating_key)&&<span>⚠ Revisar identidad de la serie</span>}</div>}
      </div>
    </section>
    <section className="series-tools series-tools-v3"><div className="tool-ids"><a href={`https://www.imdb.com/title/${item.imdb_id}/`} target="_blank" rel="noreferrer"><b>IMDb ↗</b>{item.imdb_id}</a>{item.tmdb_id?<a href={`https://www.themoviedb.org/tv/${item.tmdb_id}`} target="_blank" rel="noreferrer"><b>TMDb ↗</b>{item.tmdb_id}</a>:<span><b>TMDb</b>Falta</span>}<span><b>Plex</b>{s?.show_rating_key||'—'}</span></div><details><summary>✎ Editar IDs</summary><form action={saveIdentityAction} className="identity-form"><input type="hidden" name="imdbId" value={item.imdb_id}/><label>IMDb ID<input name="newImdbId" defaultValue={item.imdb_id}/></label><label>TMDb ID<input name="tmdbId" defaultValue={item.tmdb_id||''}/></label><button>Guardar identificadores</button></form></details><div className="series-tool-actions"><EnrichTitleButton imdbId={item.imdb_id} label="↻ Actualizar datos" className="ghost"/><form action={excludeTitle}><input type="hidden" name="imdbId" value={item.imdb_id}/><input type="hidden" name="returnTo" value={back}/><button className="series-exclude">Excluir serie</button></form></div></section>
    {seasonCards.length>0&&<section className="editorial-card editorial-seasons compact-seasons"><div className="section-head"><div><h2>Temporadas</h2><p>{seasonCards.length} temporadas · {total||episodes.length} episodios oficiales</p></div>{s?.show_rating_key&&<Link href={`/calidad/series/${s.show_rating_key}`}>Ver todos los episodios →</Link>}</div><div className="season-strip">{seasonCards.map(x=><Link href={s?.show_rating_key?`/calidad/series/${s.show_rating_key}?season=${x.sn}`:'#'} className={`season-tile ${x.pct===100?'complete':x.pct>0?'partial':'empty'}`} key={x.sn}><div><b>T{x.sn}</b><span className="season-quality">{x.quality?`PQ ${x.quality.score}`:'PQ —'}</span></div><div className="season-percent"><strong>{x.pct}%</strong><span>{x.p}/{x.total}</span></div><i><em style={{width:`${x.pct}%`}}/></i><small>{x.m?`${x.m} faltan`:x.na?`${x.na} no disp. ES`:x.u?`${x.u} por confirmar`:'Completa'}</small></Link>)}</div></section>}
    {crew.length>0&&<section className="editorial-card series-crew"><h2>Creadores y dirección</h2><div className="creator-grid">{crew.map((c,i)=><Link href={`/personas/${c.tmdb_person_id}`} key={`${c.tmdb_person_id}-${i}`}><b>{c.name}</b><span>{c.job||c.credit_type}</span></Link>)}</div></section>}
    <section className="editorial-card editorial-cast"><div className="section-head"><div><h2>Reparto principal</h2><p>Acceso a la filmografía disponible en PikoFilm.</p></div></div>{cast.length?<div className="editorial-cast-grid">{cast.map((c,i)=><Link className="editorial-person" href={`/personas/${c.tmdb_person_id}`} key={`${c.tmdb_person_id}-${i}`}>{img(c.profile_path)?<img src={img(c.profile_path)} alt=""/>:<div className="ph"/>}<b>{c.name}</b><span>{c.character_name||'Reparto'}</span></Link>)}</div>:<p className="editorial-overview">Sin reparto enriquecido disponible.</p>}</section>
  </>;
}

function EditorialMovie({item,back,notice,ratingsData}){
  const cast=item.credits.filter(c=>c.credit_type==='cast').slice(0,12);
  const crew=item.credits.filter(c=>c.credit_type!=='cast').slice(0,8);
  const director=crew.find(c=>/director/i.test(String(c.job||'')))||crew[0]||null;
  const ratings=ratingsData?.ratings||[];
  const families=ratingsData?.contributions||[];
  const confidence=ratingsData?.confidence==null?null:Number(ratingsData.confidence);
  const pikoReady=ratingsData?.score!=null;
  const release=item.release_date?new Date(item.release_date).toLocaleDateString('es-ES'):item.year||'—';
  const plex=item.effective_status==='in_plex';
  const acquiring=item.effective_status==='acquiring';
  return <div className="movie-v3">
    <div className="editorial-crumbs"><Link href={back}>Catálogo</Link><span>›</span><span>Películas</span><span>›</span><b>{item.display_title}</b></div>
    {notice==='identity_saved'&&<div className="toast success">Identificadores guardados.</div>}
    <section className="movie-hero">
      {item.poster_path?<img className="movie-poster" src={img(item.poster_path)} alt=""/>:<div className="movie-poster"/>}
      <div className="movie-copy">
        <div className="eyebrow">PELÍCULA · {plex?'EN PLEX':acquiring?'EN PROCESO':'CATÁLOGO'}</div>
        <h1>{item.display_title} {item.year&&<small>({item.year})</small>}</h1>
        {item.original_title&&item.original_title!==item.display_title&&<p className="movie-original">{item.original_title}</p>}
        <div className="movie-tags">{(item.genres||[]).slice(0,4).map(g=><span key={g}>{g}</span>)}</div>
        <div className="movie-facts"><span><b>Año</b>{item.year||'—'}</span><span><b>Duración</b>{runtimeLabel(item.runtime)}</span><span><b>País</b>{flagFor(item.country)} {item.country||'—'}</span><span><b>Estreno</b>{release}</span></div>
        {director&&<div className="hero-credit"><span>{director.job||'Dirección'}</span><b>{director.name}</b></div>}
        {item.tagline&&<p className="editorial-tagline">{item.tagline}</p>}
        <div className="movie-synopsis"><span>SINOPSIS</span><p>{item.overview||'Sin sinopsis enriquecida disponible.'}</p></div>
        <div className="movie-hero-actions">{plex?<Link className="primary" href="/plex">✓ En tu Plex</Link>:<form action={acquiring?clearAcquiring:markAcquiring}><input type="hidden" name="imdbId" value={item.imdb_id}/><button className="primary">{acquiring?'Quitar de En proceso':'+ Marcar En proceso'}</button></form>}<a href={`https://www.imdb.com/title/${item.imdb_id}/`} target="_blank" rel="noreferrer">IMDb ↗</a>{item.tmdb_id&&<a href={`https://www.themoviedb.org/movie/${item.tmdb_id}`} target="_blank" rel="noreferrer">TMDb ↗</a>}</div>
      </div>
      <div className="movie-intelligence">
        <div className="movie-piko"><div className="movie-piko-score"><span>★ PikoScore</span><strong>{pikoReady?score2(ratingsData.score):'—'}</strong><small>{pikoReady?'Valoración PikoFilm':'Pendiente de cálculo'}</small></div><div className="movie-trust"><div className="movie-trust-head"><div><span>CONFIANZA</span><b>{confidence==null?'—':`${confidence.toFixed(1)}%`}</b></div><div className="movie-trust-badges"><i>{ratingsData?.sourceCount||ratings.length} fuentes</i><i>{ratingsData?.familyCount||families.length} familias</i><i>{marketLabel(ratingsData?.market)}</i></div></div><div className="movie-trust-track"><i style={{width:`${Math.max(0,Math.min(100,confidence||0))}%`}}/></div>{families.length>0&&<div className="movie-families">{families.map(f=><div className="movie-family" key={f.family}><span>{familyLabel(f.family)}</span><b>{score1(f.score)}</b><small>{Math.round(Number(f.weight||0)*100)}% peso</small></div>)}</div>}</div></div>
        <div className="movie-source-board"><div className="movie-source-head"><div><span>VALORACIONES</span><b>{ratings.length} señales actuales</b></div>{ratingsData?.refreshedAt&&<small>Actualizadas {dateShort(ratingsData.refreshedAt)}</small>}</div>{ratings.length?<div className="movie-source-grid">{ratings.map(r=><div className="movie-source" key={r.source}><div><span>{sourceLabel(r.source)}</span><strong>{score1(r.normalized_rating)}</strong></div><small>{r.votes==null?'Volumen no publicado':`${n(r.votes)} votos/reseñas`}</small></div>)}</div>:<div className="movie-empty">Pendiente de ratings MDBList.</div>}</div>
      </div>
    </section>

    <section className="movie-status-grid">
      <div className={`movie-status-card ${plex?'ok':'warn'}`}><span>PLEX</span><strong>{plex?'Disponible en Plex':acquiring?'En proceso':'No está en Plex'}</strong><small>{item.resolution?`Resolución detectada: ${item.resolution}`:'Estado sincronizado con tu biblioteca'}</small></div>
      <div className={`movie-status-card ${item.imdb_id&&item.tmdb_id?'ok':'warn'}`}><span>IDENTIDAD</span><strong>{item.imdb_id&&item.tmdb_id?'Verificada':'Pendiente'}</strong><small>IMDb {item.imdb_id} · TMDb {item.tmdb_id||'falta'}</small></div>
      <div className="movie-status-card"><span>PIKOSCORE</span><strong>{pikoReady?`v${String(ratingsData?.version||'3.0').replace('3.0.0-experimental.','3.0.')}`:'Pendiente'}</strong><small>{ratingsData?.calculatedAt?`Calculado ${dateShort(ratingsData.calculatedAt)}`:'Todavía sin cálculo vigente'}</small></div>
    </section>

    <div className="movie-grid">
      <section className="movie-panel"><h2>Información</h2><div className="movie-info"><div><b>Director</b><span>{director?.name||'—'}</span></div><div><b>País</b><span>{item.country||'—'}</span></div><div><b>Estreno</b><span>{release}</span></div><div><b>Duración</b><span>{runtimeLabel(item.runtime)}</span></div><div><b>Idioma original</b><span>{item.original_language||'—'}</span></div><div><b>Clasificación</b><span>{item.certification||'—'}</span></div><div><b>Géneros</b><span>{(item.genres||[]).join(', ')||'—'}</span></div><div><b>Saga</b><span>{item.collection_name&&item.tmdb_collection_id?<Link className="movie-saga-link" href={`/sagas/${item.tmdb_collection_id}`}>{item.collection_name} →</Link>:item.collection_name||'—'}</span></div></div></section>
      <section className="movie-panel"><div className="section-head"><h2>Reparto principal</h2></div>{cast.length?<div className="movie-cast">{cast.map((c,i)=><Link className="movie-person" href={`/personas/${c.tmdb_person_id}`} key={`${c.tmdb_person_id}-${i}`}>{img(c.profile_path)?<img src={img(c.profile_path)} alt=""/>:<div className="ph"/>}<b>{c.name}</b><span>{c.character_name||'Reparto'}</span></Link>)}</div>:<div className="movie-empty">Sin reparto enriquecido disponible.</div>}</section>
      {crew.length>0&&<section className="movie-panel"><h2>Equipo principal</h2><div className="movie-team">{crew.map((c,i)=><Link href={`/personas/${c.tmdb_person_id}`} key={`${c.tmdb_person_id}-${i}`}><b>{c.name}</b><span>{c.job||c.credit_type}</span></Link>)}</div></section>}
      <section className="movie-panel"><h2>Calidad de datos</h2><div className="movie-info"><div><b>Identidad</b><span>{item.imdb_id&&item.tmdb_id?'IMDb + TMDb correctos':'Revisar IDs'}</span></div><div><b>Ratings</b><span>{ratings.length?`${ratings.length} fuentes actuales`:'Pendientes'}</span></div><div><b>Sinopsis</b><span>{item.overview?'Disponible':'Pendiente'}</span></div><div><b>Carátula</b><span>{item.poster_path?'Disponible':'Pendiente'}</span></div></div></section>
    </div>

    <section className="movie-admin"><div className="ids"><a href={`https://www.imdb.com/title/${item.imdb_id}/`} target="_blank" rel="noreferrer"><b>IMDb</b>{item.imdb_id} ↗</a>{item.tmdb_id?<a href={`https://www.themoviedb.org/movie/${item.tmdb_id}`} target="_blank" rel="noreferrer"><b>TMDb</b>{item.tmdb_id} ↗</a>:<span><b>TMDb</b>Falta</span>}</div><details><summary>✎ Editar identidad</summary><form action={saveIdentityAction} className="identity-form"><input type="hidden" name="imdbId" value={item.imdb_id}/><label>IMDb ID<input name="newImdbId" defaultValue={item.imdb_id}/></label><label>TMDb ID<input name="tmdbId" defaultValue={item.tmdb_id||''}/></label><button>Guardar</button></form></details><div className="movie-admin-actions"><EnrichTitleButton imdbId={item.imdb_id} label="↻ Actualizar datos" className="ghost"/><form action={excludeTitle}><input type="hidden" name="imdbId" value={item.imdb_id}/><input type="hidden" name="returnTo" value={back}/><button className="danger">Excluir película</button></form></div></section>
  </div>;
}

export default async function Ficha({params,searchParams}){
  const{imdbId}=await params,p=await searchParams,item=await getCatalogItem(imdbId);if(!item)notFound();const back=p.from&&String(p.from).startsWith('/catalogo')?p.from:'/catalogo';
  if(isSeries(item.type)){const[operational,dashboard,ratingsData]=await Promise.all([item.series?.show_rating_key?getSeriesDetail(item.series.show_rating_key):null,item.series?.show_rating_key?getSeriesDashboard(item.series.show_rating_key):null,getCatalogRatings(imdbId)]);return <EditorialSeries item={item} back={back} notice={p.notice} operational={operational} dashboard={dashboard} ratingsData={ratingsData}/>;}
  const ratingsData=await getCatalogRatings(imdbId);
  return <EditorialMovie item={item} back={back} notice={p.notice} ratingsData={ratingsData}/>;
}
