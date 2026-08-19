import Link from 'next/link';
import {notFound} from 'next/navigation';
import {getCatalogItem,getSeriesDetail} from '@/lib/queries';
import {getSeriesDashboard} from '@/lib/series-dashboard';
import {Status} from '@/components/Status';
import EnrichTitleButton from '@/components/EnrichTitleButton';
import {markAcquiring,clearAcquiring,excludeTitle,saveIdentityAction} from '@/app/actions';
import './detail-editorial.css';

export const dynamic='force-dynamic';

const img=p=>p?`https://image.tmdb.org/t/p/w342${p}`:null;
const isSeries=t=>t==='Serie'||t==='Miniserie';
const n=v=>v==null?'—':Number(v).toLocaleString('es-ES');
const qBand=b=>({excellent:'Excelente',very_good:'Muy buena',correct:'Correcta',improvable:'Mejorable',deficient:'Mala'}[b]||'—');

function EditorialSeries({item,back,notice,operational,dashboard,selectedSeason}){
  const cast=item.credits.filter(c=>c.credit_type==='cast').slice(0,8);
  const crew=item.credits.filter(c=>c.credit_type!=='cast').slice(0,6);
  const s=item.series;
  const total=s?.official_episodes||s?.diagnosed||0;
  const present=s?.present||0;
  const coverage=total?Math.round(100*present/total):0;
  const episodes=operational?.episodes||[];
  const seasonNums=[...new Set(episodes.map(e=>Number(e.season_number)).filter(x=>x>0))];
  const qBySeason=new Map((dashboard?.seasonQuality||[]).map(x=>[Number(x.season_index),x]));
  const techBySeason=new Map((dashboard?.seasonTechnical||[]).map(x=>[Number(x.season_index),x]));
  const seasonCards=seasonNums.map(sn=>{
    const es=episodes.filter(e=>Number(e.season_number)===sn);
    const p=es.filter(e=>e.effective_status==='present').length;
    const m=es.filter(e=>e.effective_status==='missing_actionable').length;
    const u=es.filter(e=>e.effective_status==='availability_unknown').length;
    const na=es.filter(e=>e.effective_status==='not_available_es').length;
    return{sn,total:es.length,p,m,u,na,pct:es.length?Math.round(100*p/es.length):0,quality:qBySeason.get(sn)||null,technical:techBySeason.get(sn)||null};
  });
  const requested=Number(selectedSeason);
  const selected=seasonCards.find(x=>x.sn===requested)||seasonCards.find(x=>x.pct<100)||seasonCards[0]||null;
  const showQuality=dashboard?.quality||null;
  const tech=dashboard?.technical||null;
  const qualityPending=!showQuality;

  return <>
    <div className="editorial-crumbs"><Link href={back}>Catálogo</Link><span>›</span><span>Series</span><span>›</span><b>{item.display_title}</b></div>
    {notice==='identity_saved'&&<div className="toast success">Identificadores guardados.</div>}

    <section className="editorial-hero">
      {item.poster_path?<img className="editorial-poster" src={img(item.poster_path)} alt=""/>:<div className="editorial-poster"/>}
      <div className="editorial-copy">
        <div className="eyebrow">{item.type} · {item.effective_status==='in_plex'?'EN PLEX':item.effective_status==='acquiring'?'EN PROCESO':'CATÁLOGO'}</div>
        <h1>{item.display_title}</h1>
        {item.original_title&&item.original_title!==item.display_title&&<p className="editorial-original">{item.original_title}</p>}
        <div className="editorial-meta">{item.year||'—'} · {(item.genres||[]).join(' · ')||'—'} · {item.country||'—'}</div>
        {item.tagline&&<p className="editorial-tagline">{item.tagline}</p>}
        {crew[0]&&<div className="hero-credit"><span>{crew[0].job||'Creador / dirección'}</span><b>{crew[0].name}</b></div>}
      </div>
      <div className="hero-side">
        <div className="hero-ratings">
          <div><span>★ PikoScore</span><strong>{item.final_rating?.toFixed?.(1)??item.final_rating??'—'}</strong></div>
          <div><span>IMDb</span><strong>{item.imdb_rating??'—'}</strong><small>{n(item.imdb_votes)} votos</small></div>
        </div>
        <div className="hero-plex">
          <b>{item.effective_status==='in_plex'?'✓ Disponible en Plex':item.effective_status==='acquiring'?'◌ En proceso':'○ Falta en Plex'}</b>
          {s&&<span>{present} / {total||'—'} episodios presentes</span>}
          {s?.show_rating_key&&<Link href={`/calidad/series/${s.show_rating_key}`}>Ver en Calidad →</Link>}
        </div>
      </div>
    </section>

    {seasonCards.length>0&&<section className="editorial-card editorial-seasons">
      <div className="section-head">
        <div><h2>Temporadas</h2><p>{seasonCards.length} temporadas diagnosticadas · {total||episodes.length} episodios oficiales</p></div>
        {s?.show_rating_key&&<Link href={`/calidad/series/${s.show_rating_key}`}>Ver detalle de episodios →</Link>}
      </div>
      <div className="season-strip">
        {seasonCards.map(x=><Link href={{pathname:`/catalogo/${item.imdb_id}`,query:{season:x.sn,from:back}}} className={`season-tile ${x.pct===100?'complete':x.pct>0?'partial':'empty'} ${selected?.sn===x.sn?'selected':''}`} key={x.sn}>
          <div><b>T{x.sn}</b><span className="season-quality">{x.quality?`PQ ${x.quality.score}`:'PQ ···'}</span></div>
          <strong>{x.total}</strong><span>episodios · {x.pct}% en Plex</span>
          <i><em style={{width:`${x.pct}%`}}/></i>
          <small>{x.m?`${x.m} faltan`:x.na?`${x.na} no disp. ES`:x.u?`${x.u} por confirmar`:'Completa'}</small>
        </Link>)}
      </div>

      {selected&&<div className="season-focus">
        <div className="season-focus-head">
          <div><span>Temporada seleccionada</span><h3>Temporada {selected.sn}</h3></div>
          <span className={`season-state ${selected.pct===100?'ok':'warn'}`}>{selected.pct===100?'COMPLETA':'INCOMPLETA'}</span>
        </div>
        <div className="season-focus-grid">
          <div className="season-metrics">
            <div><strong>{selected.total}</strong><span>Oficiales</span></div>
            <div><strong>{selected.p}</strong><span>Presentes</span></div>
            <div><strong>{selected.m}</strong><span>Faltan</span></div>
            <div><strong>{selected.u}</strong><span>Dudosos</span></div>
            <div><strong>{selected.na}</strong><span>No disp. ES</span></div>
          </div>
          <div className="season-ring" style={{'--pct':`${selected.pct*3.6}deg`}}><div><strong>{selected.pct}%</strong><span>Cobertura</span></div></div>
          <div className="season-quality-panel">
            <span>PikoQuality</span>
            {selected.quality?<><strong>{selected.quality.score}</strong><small>{qBand(selected.quality.band)} · {selected.quality.analyzed_count}/{selected.quality.total_count} analizados</small></>:<><strong className="pending">···</strong><small>Calculando / pendiente de agregados</small></>}
          </div>
        </div>
        <div className="season-techline">
          <span><b>Resolución</b>{selected.technical?.resolution||'Pendiente'}</span>
          <span><b>Vídeo</b>{selected.technical?.video_codec||'Pendiente'}</span>
          <span><b>Audio</b>{selected.technical?.audio_codec||'Pendiente'}{selected.technical?.audio_channels?` ${selected.technical.audio_channels}ch`:''}</span>
          {s?.show_rating_key&&<Link href={`/calidad/series/${s.show_rating_key}?season=${selected.sn}`}>Ver episodios de T{selected.sn} →</Link>}
        </div>
      </div>}
    </section>}

    <div className="editorial-dashboard">
      <div>
        <section className="editorial-card"><h2>Sinopsis</h2><p className="editorial-overview">{item.overview||'Sin sinopsis enriquecida disponible.'}</p></section>
        <section className="editorial-card editorial-info-card"><h2>Información</h2><div className="editorial-info">
          <div><b>Géneros</b><span>{(item.genres||[]).join(', ')||'—'}</span></div><div><b>País</b><span>{item.country||'—'}</span></div>
          <div><b>Estreno</b><span>{item.release_date?new Date(item.release_date).toLocaleDateString('es-ES'):item.year||'—'}</span></div><div><b>Tipo</b><span>{item.type}</span></div>
          <div><b>Temporadas oficiales</b><span>{s?.official_seasons??seasonCards.length??'—'}</span></div><div><b>Episodios oficiales</b><span>{s?.official_episodes??'—'}</span></div>
          <div><b>Duración media</b><span>{item.runtime?`${item.runtime} min`:'—'}</span></div><div><b>Idioma original</b><span>{item.original_language||'—'}</span></div>
        </div></section>
        {crew.length>0&&<section className="editorial-card"><h2>Creadores y dirección</h2><div className="creator-grid">{crew.map((c,i)=><Link href={`/personas/${c.tmdb_person_id}`} key={`${c.tmdb_person_id}-${i}`}><b>{c.name}</b><span>{c.job||c.credit_type}</span></Link>)}</div></section>}
      </div>

      <aside className="ops-stack">
        <section className="editorial-card coverage-card"><h2>Cobertura global</h2><div className="coverage-line"><div className="mini-ring" style={{'--pct':`${coverage*3.6}deg`}}><strong>{coverage}%</strong></div><div><b>{present} / {total||'—'}</b><span>Episodios presentes</span><small>{s?.missing||0} faltan · {s?.unknown||0} por confirmar</small></div></div></section>
        <section className="editorial-card"><h2>Disponibilidad en España</h2><div className={`availability-state ${(s?.not_available_es||0)>0?'warn':'ok'}`}>{(s?.not_available_es||0)>0?'◌ Disponibilidad parcial':'✓ Disponibilidad completa'}</div><div className="editorial-foot">{s?.not_available_es||0} episodios marcados como no disponibles en España</div></section>
        <section className="editorial-card quality-summary"><h2>Calidad técnica</h2>{qualityPending?<div className="quality-pending"><strong>Calculando</strong><span>Los agregados de PikoQuality todavía no están disponibles.</span></div>:<div className="quality-score-row"><div className="quality-dial"><strong>{showQuality.score}</strong><span>/100</span></div><div><b>{qBand(showQuality.band)}</b><span>{showQuality.analyzed_count}/{showQuality.total_count} episodios analizados</span><small>v{showQuality.formula_version}</small></div></div>}<div className="tech-summary"><div><span>Resolución mayoritaria</span><b>{tech?.resolution||'Pendiente'}</b></div><div><span>Códec de vídeo</span><b>{tech?.video_codec||'Pendiente'}</b></div><div><span>Códec de audio</span><b>{tech?.audio_codec||'Pendiente'}{tech?.audio_channels?` ${tech.audio_channels}ch`:''}</b></div></div>{s?.show_rating_key&&<Link className="quality-link" href={`/calidad/series/${s.show_rating_key}`}>Ver detalle por temporadas →</Link>}</section>
        <section className="editorial-card"><h2>Identidad y mapeado</h2><div className="mapping-state">✓ Sin incidencias detectadas</div><div className="editorial-foot">IMDb, TMDb y Plex vinculados en la ficha.</div></section>
      </aside>
    </div>

    <section className="editorial-card editorial-cast"><div className="section-head"><div><h2>Reparto principal</h2><p>Acceso a la filmografía disponible en PikoFilm.</p></div></div>{cast.length?<div className="editorial-cast-grid">{cast.map((c,i)=><Link className="editorial-person" href={`/personas/${c.tmdb_person_id}`} key={`${c.tmdb_person_id}-${i}`}>{img(c.profile_path)?<img src={img(c.profile_path)} alt=""/>:<div className="ph"/>}<b>{c.name}</b><span>{c.character_name||'Reparto'}</span></Link>)}</div>:<p className="editorial-overview">Sin reparto enriquecido disponible.</p>}</section>

    <div className="editorial-bottom">
      <section className="editorial-card"><h2>Identificadores</h2><div className="editorial-ids"><div><b>IMDb</b><span>{item.imdb_id}</span></div><div><b>TMDb</b><span>{item.tmdb_id||'Falta'}</span></div><div><b>FilmAffinity</b><span>{item.fa_id||'Falta'}</span></div><div><b>Plex</b><span>{s?.show_rating_key||'—'}</span></div></div><details><summary>Editar identificadores</summary><form action={saveIdentityAction} className="identity-form"><input type="hidden" name="imdbId" value={item.imdb_id}/><label>IMDb ID<input name="newImdbId" defaultValue={item.imdb_id}/></label><label>TMDb ID<input name="tmdbId" defaultValue={item.tmdb_id||''}/></label><label>FilmAffinity ID<input name="faId" defaultValue={item.fa_id||''}/></label><button>Guardar identificadores</button></form></details></section>
      <section className="editorial-card"><h2>Acciones de administración</h2><div className="editorial-actions"><EnrichTitleButton imdbId={item.imdb_id} label="Actualizar datos" className="ghost"/>{item.effective_status!=='in_plex'&&<form action={item.effective_status==='acquiring'?clearAcquiring:markAcquiring}><input type="hidden" name="imdbId" value={item.imdb_id}/><button>{item.effective_status==='acquiring'?'Quitar de En proceso':'Marcar En proceso'}</button></form>}<a href={`https://www.imdb.com/title/${item.imdb_id}/`} target="_blank" rel="noreferrer">Ver en IMDb</a>{item.effective_status!=='in_plex'&&<form action={excludeTitle}><input type="hidden" name="imdbId" value={item.imdb_id}/><input type="hidden" name="returnTo" value={back}/><button className="danger">Excluir</button></form>}</div></section>
    </div>
  </>;
}

export default async function Ficha({params,searchParams}){
  const{imdbId}=await params,p=await searchParams,item=await getCatalogItem(imdbId);
  if(!item)notFound();
  const back=p.from&&String(p.from).startsWith('/catalogo')?p.from:'/catalogo';
  if(isSeries(item.type)){
    const operational=item.series?.show_rating_key?await getSeriesDetail(item.series.show_rating_key):null;
    const dashboard=item.series?.show_rating_key?await getSeriesDashboard(item.series.show_rating_key):null;
    return <EditorialSeries item={item} back={back} notice={p.notice} operational={operational} dashboard={dashboard} selectedSeason={p.season}/>;
  }
  const cast=item.credits.filter(c=>c.credit_type==='cast').slice(0,18),crew=item.credits.filter(c=>c.credit_type!=='cast').slice(0,8);
  return <><Link className="back" href={back}>← Volver a resultados</Link>{p.notice==='identity_saved'&&<div className="toast success">Identificadores guardados. Puedes pulsar “Actualizar datos” para revalidar todas las fuentes.</div>}<div className="detail-head"><div><div className="eyebrow">Película · {item.year||'—'}</div><h1>{item.display_title}</h1>{item.original_title&&item.original_title!==item.display_title&&<p className="original">{item.original_title}</p>}<div className="detail-status"><Status value={item.effective_status}/>{item.resolution&&<span className="pill">{item.resolution}</span>}{item.runtime&&<span className="pill">{item.runtime} min</span>}</div><div className="quick-actions"><EnrichTitleButton imdbId={item.imdb_id} label="Actualizar datos" className="ghost"/>{item.effective_status!=='in_plex'&&<><form action={item.effective_status==='acquiring'?clearAcquiring:markAcquiring}><input type="hidden" name="imdbId" value={item.imdb_id}/><button>{item.effective_status==='acquiring'?'Quitar de En proceso':'Marcar En proceso'}</button></form><form action={excludeTitle}><input type="hidden" name="imdbId" value={item.imdb_id}/><input type="hidden" name="returnTo" value={back}/><button className="ghost danger-soft">Excluir del catálogo</button></form></>}</div></div><div className="score"><span>{item.final_rating?.toFixed?.(2)??item.final_rating??'—'}</span><small>PikoScore</small></div></div>{item.tagline&&<p className="tagline">{item.tagline}</p>}<div className="detail-grid"><section className="card"><h3>Información</h3><p>{item.overview||'Sin sinopsis enriquecida.'}</p><div className="meta-list"><div><b>País</b><span>{item.country||'—'}</span></div><div><b>Estreno</b><span>{item.release_date?new Date(item.release_date).toLocaleDateString('es-ES'):item.year||'—'}</span></div><div><b>Géneros</b><span>{(item.genres||[]).join(', ')||'—'}</span></div><div><b>Saga</b><span>{item.collection_name&&item.tmdb_collection_id?<Link href={`/sagas/${item.tmdb_collection_id}`}>{item.collection_name}</Link>:item.collection_name||'—'}</span></div></div></section><section className="card ratings-card"><h3>Valoración PikoFilm</h3><div className="piko-score-big">{item.final_rating?.toFixed?.(2)??item.final_rating??'—'}</div><div className="rating-row"><b>IMDb</b><span>{item.imdb_rating??'—'} · {item.imdb_votes?.toLocaleString?.('es-ES')??0} votos</span></div><div className="rating-row"><b>FilmAffinity</b><span>{item.fa_rating??'—'} · {item.fa_votes?.toLocaleString?.('es-ES')??0} votos</span></div><div className="rating-row"><b>TMDb</b><span>{item.tmdb_rating??'—'} · {item.tmdb_votes?.toLocaleString?.('es-ES')??0} votos</span></div></section></div><section className="card identity-card"><div className="section-head"><div><div className="eyebrow">Identidad</div><h2>Identificadores</h2></div><span className="pill">Editables</span></div><div className="id-grid"><div><b>IMDb</b><span>{item.imdb_id}</span></div><div><b>TMDb</b><span>{item.tmdb_id||'Falta'}</span></div><div><b>FilmAffinity</b><span>{item.fa_id||'Falta'}</span></div></div></section><section className="section"><div className="section-head"><h2>Reparto principal</h2></div><div className="people-grid">{cast.map((c,i)=><Link className="person-card" href={`/personas/${c.tmdb_person_id}`} key={`${c.tmdb_person_id}-${i}`}>{img(c.profile_path)?<img src={img(c.profile_path)} alt=""/>:<div className="person-placeholder">👤</div>}<b>{c.name}</b><span>{c.character_name||'Reparto'}</span></Link>)}</div></section>{crew.length>0&&<section className="section"><div className="section-head"><h2>Equipo</h2></div><div className="credit-grid">{crew.map((c,i)=><Link href={`/personas/${c.tmdb_person_id}`} className="credit" key={`${c.tmdb_person_id}-${i}`}><b>{c.name}</b><span>{c.job||c.credit_type}</span></Link>)}</div></section>}</>;
}
