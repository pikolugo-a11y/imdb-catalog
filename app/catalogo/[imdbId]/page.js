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
const qClass=b=>b==='excellent'||b==='very_good'?'good':b==='correct'?'mid':b==='improvable'?'warn':'bad';
const cleanSeriesTitle=t=>String(t||'').replace(/\s*\((?:Serie de TV|TV Series)\)\s*$/i,'');
const flagFor=c=>({
  'Estados Unidos':'🇺🇸','España':'🇪🇸','Reino Unido':'🇬🇧','Francia':'🇫🇷','Italia':'🇮🇹','Alemania':'🇩🇪','Canadá':'🇨🇦','Japón':'🇯🇵','Corea del Sur':'🇰🇷','Australia':'🇦🇺','México':'🇲🇽','Argentina':'🇦🇷','Brasil':'🇧🇷','Suecia':'🇸🇪','Noruega':'🇳🇴','Dinamarca':'🇩🇰','Finlandia':'🇫🇮','Irlanda':'🇮🇪','Bélgica':'🇧🇪','Países Bajos':'🇳🇱','Nueva Zelanda':'🇳🇿'
}[c]||'🌐');

function EditorialSeries({item,back,notice,operational,dashboard}){
  const cast=item.credits.filter(c=>c.credit_type==='cast').slice(0,8);
  const crew=item.credits.filter(c=>c.credit_type!=='cast').slice(0,6);
  const s=item.series;
  const total=s?.official_episodes||s?.diagnosed||0;
  const present=s?.present||0;
  const coverage=total?Math.round(100*present/total):0;
  const episodes=operational?.episodes||[];
  const seasonNums=[...new Set(episodes.map(e=>Number(e.season_number)).filter(x=>x>0))];
  const qBySeason=new Map((dashboard?.seasonQuality||[]).map(x=>[Number(x.season_index),x]));
  const seasonCards=seasonNums.map(sn=>{
    const es=episodes.filter(e=>Number(e.season_number)===sn);
    const p=es.filter(e=>e.effective_status==='present').length;
    const m=es.filter(e=>e.effective_status==='missing_actionable').length;
    const u=es.filter(e=>e.effective_status==='availability_unknown').length;
    const na=es.filter(e=>e.effective_status==='not_available_es').length;
    return{sn,total:es.length,p,m,u,na,pct:es.length?Math.round(100*p/es.length):0,quality:qBySeason.get(sn)||null};
  });
  const quality=dashboard?.quality||null;
  const tech=dashboard?.technical||null;
  const title=cleanSeriesTitle(item.display_title);
  const release=item.release_date?new Date(item.release_date).toLocaleDateString('es-ES'):item.year||'—';
  const identityOk=Boolean(item.imdb_id&&item.tmdb_id&&s?.show_rating_key);
  const availabilityOk=(s?.not_available_es||0)===0;

  return <>
    <div className="editorial-crumbs"><Link href={back}>Catálogo</Link><span>›</span><span>Series</span><span>›</span><b>{title}</b></div>
    {notice==='identity_saved'&&<div className="toast success">Identificadores guardados.</div>}

    <section className="series-command">
      <div className="series-command-main">
        {item.poster_path?<img className="command-poster" src={img(item.poster_path)} alt=""/>:<div className="command-poster"/>}
        <div className="command-copy">
          <div className="eyebrow">{item.type} · {item.effective_status==='in_plex'?'EN PLEX':item.effective_status==='acquiring'?'EN PROCESO':'CATÁLOGO'}</div>
          <h1>{title}</h1>
          {item.original_title&&cleanSeriesTitle(item.original_title)!==title&&<p className="editorial-original">{cleanSeriesTitle(item.original_title)}</p>}
          {item.tagline&&<p className="editorial-tagline">{item.tagline}</p>}
          <div className="command-facts">
            <span><b>Géneros</b>{(item.genres||[]).join(' · ')||'—'}</span>
            <span><b>País</b><i>{flagFor(item.country)}</i>{item.country||'—'}</span>
            <span><b>Estreno</b>{release}</span>
          </div>
          {crew[0]&&<div className="hero-credit"><span>{crew[0].job||'Creador / dirección'}</span><b>{crew[0].name}</b></div>}
        </div>
      </div>

      <div className="command-health">
        <div className="score-pair">
          <div><span>★ PikoScore</span><strong>{item.final_rating?.toFixed?.(1)??item.final_rating??'—'}</strong></div>
          <div><span>IMDb</span><strong>{item.imdb_rating??'—'}</strong><small>{n(item.imdb_votes)} votos</small></div>
        </div>
        <div className={`hero-quality ${quality?qClass(quality.band):'pending'}`}>
          <span>PIKOQUALITY</span>
          {quality?<><strong>{quality.score}</strong><b>{qBand(quality.band)}</b><small>{quality.analyzed_count}/{quality.total_count} episodios analizados</small></>:<><strong>···</strong><b>Calculando</b><small>Pendiente de agregados</small></>}
        </div>
        <div className={`hero-coverage ${coverage===100?'good':coverage>=80?'warn':'bad'}`}>
          <div className="hero-ring" style={{'--pct':`${coverage*3.6}deg`}}><strong>{coverage}%</strong></div>
          <div><span>COBERTURA PLEX</span><b>{present} / {total||'—'}</b><small>{s?.missing||0} faltan · {s?.unknown||0} por confirmar</small></div>
        </div>
        <div className="health-flags">
          <span className={availabilityOk?'ok':'warn'}>{availabilityOk?'✓':'!'} España {availabilityOk?'completa':`${s?.not_available_es||0} no disponibles`}</span>
          <span className={identityOk?'ok':'warn'}>{identityOk?'✓':'!'} {identityOk?'Identidad correcta':'Revisar identidad'}</span>
        </div>
        <div className="tech-pills"><span>{tech?.resolution?.toUpperCase?.()||'—'}</span><span>{tech?.video_codec?.toUpperCase?.()||'—'}</span><span>{tech?.audio_codec?.toUpperCase?.()||'—'}{tech?.audio_channels?` ${tech.audio_channels}ch`:''}</span></div>
      </div>
    </section>

    <section className="series-tools">
      <div className="tool-ids"><span><b>IMDb</b>{item.imdb_id}</span><span><b>TMDb</b>{item.tmdb_id||'Falta'}</span><span><b>FA</b>{item.fa_id||'Falta'}</span><span><b>Plex</b>{s?.show_rating_key||'—'}</span></div>
      <details><summary>✎ Editar IDs</summary><form action={saveIdentityAction} className="identity-form"><input type="hidden" name="imdbId" value={item.imdb_id}/><label>IMDb ID<input name="newImdbId" defaultValue={item.imdb_id}/></label><label>TMDb ID<input name="tmdbId" defaultValue={item.tmdb_id||''}/></label><label>FilmAffinity ID<input name="faId" defaultValue={item.fa_id||''}/></label><button>Guardar identificadores</button></form></details>
      <div className="series-tool-actions"><EnrichTitleButton imdbId={item.imdb_id} label="↻ Actualizar datos" className="ghost"/><a href={`https://www.imdb.com/title/${item.imdb_id}/`} target="_blank" rel="noreferrer">IMDb ↗</a></div>
    </section>

    {seasonCards.length>0&&<section className="editorial-card editorial-seasons compact-seasons">
      <div className="section-head"><div><h2>Temporadas</h2><p>{seasonCards.length} temporadas · {total||episodes.length} episodios oficiales</p></div>{s?.show_rating_key&&<Link href={`/calidad/series/${s.show_rating_key}`}>Ver todos los episodios →</Link>}</div>
      <div className="season-strip">
        {seasonCards.map(x=><Link href={s?.show_rating_key?`/calidad/series/${s.show_rating_key}?season=${x.sn}`:'#'} className={`season-tile ${x.pct===100?'complete':x.pct>0?'partial':'empty'}`} key={x.sn}>
          <div><b>T{x.sn}</b><span className="season-quality">{x.quality?`PQ ${x.quality.score}`:'PQ —'}</span></div>
          <div className="season-percent"><strong>{x.pct}%</strong><span>{x.p}/{x.total}</span></div>
          <i><em style={{width:`${x.pct}%`}}/></i>
          <small>{x.m?`${x.m} faltan`:x.na?`${x.na} no disp. ES`:x.u?`${x.u} por confirmar`:'Completa'}</small>
        </Link>)}
      </div>
    </section>}

    <section className="editorial-card series-synopsis"><h2>Sinopsis</h2><p className="editorial-overview">{item.overview||'Sin sinopsis enriquecida disponible.'}</p></section>

    {crew.length>0&&<section className="editorial-card series-crew"><h2>Creadores y dirección</h2><div className="creator-grid">{crew.map((c,i)=><Link href={`/personas/${c.tmdb_person_id}`} key={`${c.tmdb_person_id}-${i}`}><b>{c.name}</b><span>{c.job||c.credit_type}</span></Link>)}</div></section>}

    <section className="editorial-card editorial-cast"><div className="section-head"><div><h2>Reparto principal</h2><p>Acceso a la filmografía disponible en PikoFilm.</p></div></div>{cast.length?<div className="editorial-cast-grid">{cast.map((c,i)=><Link className="editorial-person" href={`/personas/${c.tmdb_person_id}`} key={`${c.tmdb_person_id}-${i}`}>{img(c.profile_path)?<img src={img(c.profile_path)} alt=""/>:<div className="ph"/>}<b>{c.name}</b><span>{c.character_name||'Reparto'}</span></Link>)}</div>:<p className="editorial-overview">Sin reparto enriquecido disponible.</p>}</section>
  </>;
}

export default async function Ficha({params,searchParams}){
  const{imdbId}=await params,p=await searchParams,item=await getCatalogItem(imdbId);
  if(!item)notFound();
  const back=p.from&&String(p.from).startsWith('/catalogo')?p.from:'/catalogo';
  if(isSeries(item.type)){
    const operational=item.series?.show_rating_key?await getSeriesDetail(item.series.show_rating_key):null;
    const dashboard=item.series?.show_rating_key?await getSeriesDashboard(item.series.show_rating_key):null;
    return <EditorialSeries item={item} back={back} notice={p.notice} operational={operational} dashboard={dashboard}/>;
  }
  const cast=item.credits.filter(c=>c.credit_type==='cast').slice(0,18),crew=item.credits.filter(c=>c.credit_type!=='cast').slice(0,8);
  return <><Link className="back" href={back}>← Volver a resultados</Link>{p.notice==='identity_saved'&&<div className="toast success">Identificadores guardados. Puedes pulsar “Actualizar datos” para revalidar todas las fuentes.</div>}<div className="detail-head"><div><div className="eyebrow">Película · {item.year||'—'}</div><h1>{item.display_title}</h1>{item.original_title&&item.original_title!==item.display_title&&<p className="original">{item.original_title}</p>}<div className="detail-status"><Status value={item.effective_status}/>{item.resolution&&<span className="pill">{item.resolution}</span>}{item.runtime&&<span className="pill">{item.runtime} min</span>}</div><div className="quick-actions"><EnrichTitleButton imdbId={item.imdb_id} label="Actualizar datos" className="ghost"/>{item.effective_status!=='in_plex'&&<><form action={item.effective_status==='acquiring'?clearAcquiring:markAcquiring}><input type="hidden" name="imdbId" value={item.imdb_id}/><button>{item.effective_status==='acquiring'?'Quitar de En proceso':'Marcar En proceso'}</button></form><form action={excludeTitle}><input type="hidden" name="imdbId" value={item.imdb_id}/><input type="hidden" name="returnTo" value={back}/><button className="ghost danger-soft">Excluir del catálogo</button></form></>}</div></div><div className="score"><span>{item.final_rating?.toFixed?.(2)??item.final_rating??'—'}</span><small>PikoScore</small></div></div>{item.tagline&&<p className="tagline">{item.tagline}</p>}<div className="detail-grid"><section className="card"><h3>Información</h3><p>{item.overview||'Sin sinopsis enriquecida.'}</p><div className="meta-list"><div><b>País</b><span>{item.country||'—'}</span></div><div><b>Estreno</b><span>{item.release_date?new Date(item.release_date).toLocaleDateString('es-ES'):item.year||'—'}</span></div><div><b>Géneros</b><span>{(item.genres||[]).join(', ')||'—'}</span></div><div><b>Saga</b><span>{item.collection_name&&item.tmdb_collection_id?<Link href={`/sagas/${item.tmdb_collection_id}`}>{item.collection_name}</Link>:item.collection_name||'—'}</span></div></div></section><section className="card ratings-card"><h3>Valoración PikoFilm</h3><div className="piko-score-big">{item.final_rating?.toFixed?.(2)??item.final_rating??'—'}</div><div className="rating-row"><b>IMDb</b><span>{item.imdb_rating??'—'} · {item.imdb_votes?.toLocaleString?.('es-ES')??0} votos</span></div><div className="rating-row"><b>FilmAffinity</b><span>{item.fa_rating??'—'} · {item.fa_votes?.toLocaleString?.('es-ES')??0} votos</span></div><div className="rating-row"><b>TMDb</b><span>{item.tmdb_rating??'—'} · {item.tmdb_votes?.toLocaleString?.('es-ES')??0} votos</span></div></section></div><section className="card identity-card"><div className="section-head"><div><div className="eyebrow">Identidad</div><h2>Identificadores</h2></div><span className="pill">Editables</span></div><div className="id-grid"><div><b>IMDb</b><span>{item.imdb_id}</span></div><div><b>TMDb</b><span>{item.tmdb_id||'Falta'}</span></div><div><b>FilmAffinity</b><span>{item.fa_id||'Falta'}</span></div></div></section><section className="section"><div className="section-head"><h2>Reparto principal</h2></div><div className="people-grid">{cast.map((c,i)=><Link className="person-card" href={`/personas/${c.tmdb_person_id}`} key={`${c.tmdb_person_id}-${i}`}>{img(c.profile_path)?<img src={img(c.profile_path)} alt=""/>:<div className="person-placeholder">👤</div>}<b>{c.name}</b><span>{c.character_name||'Reparto'}</span></Link>)}</div></section>{crew.length>0&&<section className="section"><div className="section-head"><h2>Equipo</h2></div><div className="credit-grid">{crew.map((c,i)=><Link href={`/personas/${c.tmdb_person_id}`} className="credit" key={`${c.tmdb_person_id}-${i}`}><b>{c.name}</b><span>{c.job||c.credit_type}</span></Link>)}</div></section>}</>;
}