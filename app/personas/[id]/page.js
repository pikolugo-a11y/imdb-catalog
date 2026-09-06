import Link from '@/components/NoPrefetchLink';
import {notFound} from 'next/navigation';
import {getPersonV2} from '@/lib/people-v2';
import {addSagaMemberToNews} from '@/app/actions';
import {refreshPersonFilmographyAction} from '../actions';
import '../personas-v4.css';

export const dynamic='force-dynamic';

const image=(p,w='w342')=>p?`https://image.tmdb.org/t/p/${w}${p}`:null;
const safeDate=d=>{if(!d)return null;const x=d instanceof Date?d:new Date(d);return Number.isNaN(x.getTime())?null:x};
const fmt=d=>{const x=safeDate(d);return x?new Intl.DateTimeFormat('es-ES',{day:'numeric',month:'long',year:'numeric',timeZone:'UTC'}).format(x):'—'};
const age=(b,d)=>{const x=safeDate(b),y=safeDate(d)||new Date();return x?Math.max(0,Math.floor((y-x)/31557600000)):null};
const score=v=>v==null?'—':Number(v).toFixed(2);

export default async function Persona({params,searchParams}){
  const{id}=await params,p=await searchParams,person=await getPersonV2(id);
  if(!person)notFound();
  const role=String(p.role||'cast')==='director'?'director':'cast';
  const view=String(p.view||'relevant')==='other'?'other':'relevant';
  const allowedStates=new Set(['all','catalog','outside','plex','recent']);
  const state=allowedStates.has(String(p.state||''))?String(p.state):'all';
  const requestedBack=String(p.returnTo||'');
  const backTo=requestedBack.startsWith('/personas')||requestedBack.startsWith('/calidad/personas')?requestedBack:'/personas';
  const backLabel=backTo.startsWith('/calidad/personas')?'Calidad · Personas':'Personas';
  const backQuery=`&returnTo=${encodeURIComponent(backTo)}`;
  const raw=person.titles.filter(x=>role==='director'?x.credit_type==='crew':x.credit_type==='cast');
  const relevant=raw.filter(x=>x.in_catalog||x.is_pikofilm_relevant!==false);
  const other=raw.filter(x=>!x.in_catalog&&x.is_pikofilm_relevant===false);
  const catalogCount=relevant.filter(x=>x.in_catalog).length;
  const outsideCount=relevant.filter(x=>!x.in_catalog).length;
  const plexCount=relevant.filter(x=>x.effective_status==='in_plex').length;
  const recentCount=relevant.filter(x=>x.availability_phase!=='available').length;
  const scored=relevant.filter(x=>x.final_rating!=null);
  const avg=scored.length?scored.reduce((a,x)=>a+Number(x.final_rating),0)/scored.length:null;
  const all=view==='other'?other:relevant;
  const rows=all.filter(x=>view==='other'||state==='all'||state==='catalog'&&x.in_catalog||state==='outside'&&!x.in_catalog||state==='plex'&&x.effective_status==='in_plex'||state==='recent'&&x.availability_phase!=='available');
  const href=(s='all',v=view,r=role)=>`/personas/${id}?role=${r}&view=${v}&state=${s}${backQuery}`;
  const years=age(person.birthday,person.deathday),detailReturn=href(state,view,role);
  return <div className="personas-v4 pv4-detail">
    <div className="pdv4-top"><Link className="pdv4-back" href={backTo}>← {backLabel}</Link><form action={refreshPersonFilmographyAction}><input type="hidden" name="personId" value={id}/><input type="hidden" name="returnTo" value={detailReturn}/><button className="pdv4-refresh">↻ Actualizar filmografía</button></form></div>

    <header className="pdv4-hero">
      <div className="pdv4-photo">{image(person.profile_path)?<img src={image(person.profile_path)} alt=""/>:<span>👤</span>}</div>
      <div className="pdv4-identity"><span className="pv4-eyebrow">Persona · PikoFilm</span><h1>{person.name}</h1><div className="pdv4-facts"><span>{person.known_for_department||'Cine'}</span>{years!=null&&<span>{years} años{person.deathday?' al fallecer':''}</span>}{person.place_of_birth&&<span>{person.place_of_birth}</span>}</div>{person.biography?<p>{person.biography}</p>:<p className="muted">Biografía pendiente de actualización.</p>}<div className="pdv4-life"><span><small>Nacimiento</small><b>{fmt(person.birthday)}</b></span>{person.deathday&&<span><small>Fallecimiento</small><b>{fmt(person.deathday)}</b></span>}<span><small>Última filmografía</small><b>{person.filmography_refreshed_at?fmt(person.filmography_refreshed_at):'Sin actualizar'}</b></span></div></div>
    </header>

    <section className="pdv4-metrics" aria-label="Resumen de filmografía"><article><span>Filmografía relevante</span><strong>{relevant.length}</strong><small>{other.length} créditos secundarios aparte</small></article><article><span>PikoScore medio</span><strong className="pv4-score">{score(avg)}</strong><small>{scored.length} obras valoradas</small></article><article><span>En Plex</span><strong className="pv4-plex">{plexCount}</strong><small>presencia física</small></article><article><span>Fuera de PikoFilm</span><strong className={outsideCount>0?'pv4-outside':''}>{outsideCount}</strong><small>obras relevantes por explorar</small></article></section>

    <nav className="pdv4-role-tabs" aria-label="Tipo de crédito"><Link className={role==='cast'?'active':''} href={href('all','relevant','cast')}>Interpretación</Link><Link className={role==='director'?'active':''} href={href('all','relevant','director')}>Dirección</Link></nav>
    <div className="pdv4-viewbar"><nav><Link className={view==='relevant'?'active':''} href={href('all','relevant')}>Filmografía relevante · {relevant.length}</Link><Link className={view==='other'?'active':''} href={href('all','other')}>Otros créditos · {other.length}</Link></nav>{view==='relevant'&&<span>Orden: año, de más reciente a más antigua</span>}</div>

    {view==='relevant'&&<nav className="pdv4-filters" aria-label="Estado de la filmografía">{[['all','Todas',relevant.length],['catalog','En PikoFilm',catalogCount],['outside','Fuera de PikoFilm',outsideCount],['plex','En Plex',plexCount],['recent','Estrenos',recentCount]].map(([k,l,c])=><Link className={state===k?'active':''} key={k} href={href(k)}>{l} <b>{c}</b></Link>)}</nav>}

    {rows.length===0?<section className="pv4-empty"><strong>No hay títulos en esta vista</strong><p>Cambia el filtro para consultar el resto de la filmografía guardada.</p></section>:<div className="pdv4-table-shell"><table className="pdv4-table"><thead><tr><th>Año</th><th>Película</th><th>Papel</th>{view==='other'&&<th>Motivo</th>}<th>Estado</th><th className="num">PikoScore</th><th className="num">PikoQuality</th><th>Acción</th></tr></thead><tbody>{rows.map(x=>{const status=x.effective_status==='in_plex'?'En Plex':x.in_catalog?'En PikoFilm':x.availability_phase==='upcoming'?'Próximamente':x.availability_phase==='recent'?'Estreno reciente':'Fuera de PikoFilm';const reason={short:'Corto (<60 min)',self_or_archive:'Self / archivo',bonus_or_special:'Making-of / especial'}[x.relevance_reason]||x.relevance_reason||'Crédito secundario';return <tr key={`${x.tmdb_movie_id}-${x.credit_type}`}><td>{x.year||'—'}</td><td><div className="pdv4-movie">{image(x.catalog_poster||x.poster_path,'w92')?<img src={image(x.catalog_poster||x.poster_path,'w92')} alt=""/>:<span/>}<div><strong>{x.display_title||x.title}</strong><small>{x.runtime?`${x.runtime} min`:''}</small></div></div></td><td className="pdv4-role">{role==='director'?'Director/a':x.character_name||'—'}</td>{view==='other'&&<td><span className="pdv4-reason">{reason}</span></td>}<td><span className={`pdv4-state ${x.effective_status==='in_plex'?'plex':!x.in_catalog?'outside':'catalog'}`}>{status}</span></td><td className="num pv4-score">{score(x.final_rating)}</td><td className="num">{x.pikoquality_score??'—'}{x.pikoquality_band&&<small>{x.pikoquality_band}</small>}</td><td>{x.in_catalog&&x.imdb_id?<Link className="pdv4-action" href={`/catalogo/${x.imdb_id}`}>Ver ficha →</Link>:view==='other'?<span className="muted">Secundario</span>:x.novedades_status&&x.imdb_id?<Link className="pdv4-action" href={`/novedades?q=${encodeURIComponent(x.imdb_id)}`}>✓ Novedades</Link>:x.imdb_id?<form action={addSagaMemberToNews}><input type="hidden" name="imdbId" value={x.imdb_id}/><input type="hidden" name="tmdbMovieId" value={x.tmdb_movie_id}/><input type="hidden" name="title" value={x.title||''}/><input type="hidden" name="year" value={x.year||''}/><input type="hidden" name="returnTo" value={detailReturn}/><button className="pdv4-action button">+ Novedades</button></form>:<span className="muted">IMDb por resolver</span>}</td></tr>})}</tbody></table>
      <div className="pdv4-mobile-list">{rows.map(x=>{const status=x.effective_status==='in_plex'?'En Plex':x.in_catalog?'En PikoFilm':x.availability_phase==='upcoming'?'Próximamente':x.availability_phase==='recent'?'Estreno reciente':'Fuera de PikoFilm';const reason={short:'Corto (<60 min)',self_or_archive:'Self / archivo',bonus_or_special:'Making-of / especial'}[x.relevance_reason]||x.relevance_reason||'Crédito secundario';return <article className="pdv4-mobile-row" key={`m-${x.tmdb_movie_id}-${x.credit_type}`}><div><span className="pdv4-year">{x.year||'—'}</span><strong>{x.display_title||x.title}</strong><small>{view==='other'?reason:role==='director'?'Dirección':x.character_name||'Interpretación'}</small></div><div className="pdv4-mobile-meta"><span className={`pdv4-state ${x.effective_status==='in_plex'?'plex':!x.in_catalog?'outside':'catalog'}`}>{status}</span><b className="pv4-score">{score(x.final_rating)} <small>PikoScore</small></b></div><div className="pdv4-mobile-action">{x.in_catalog&&x.imdb_id?<Link href={`/catalogo/${x.imdb_id}`}>Ver ficha →</Link>:view==='other'?<span>Crédito secundario</span>:x.novedades_status&&x.imdb_id?<Link href={`/novedades?q=${encodeURIComponent(x.imdb_id)}`}>✓ En Novedades</Link>:x.imdb_id?<form action={addSagaMemberToNews}><input type="hidden" name="imdbId" value={x.imdb_id}/><input type="hidden" name="tmdbMovieId" value={x.tmdb_movie_id}/><input type="hidden" name="title" value={x.title||''}/><input type="hidden" name="year" value={x.year||''}/><input type="hidden" name="returnTo" value={detailReturn}/><button>+ Novedades</button></form>:<span>IMDb por resolver</span>}</div></article>})}</div>
    </div>}
  </div>;
}
