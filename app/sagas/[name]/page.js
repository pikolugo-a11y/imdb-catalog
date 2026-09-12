import Link from '@/components/NoPrefetchLink';
import ActionButton from '@/components/ActionButton';
import {notFound} from 'next/navigation';
import {getSagaDetailV3} from '@/lib/sagas-v3';
import {addSagaMemberToNewsAction} from '@/app/sagas/saga-news-actions';
import {refreshSagaCollectionAction} from '@/app/sagas/refresh-actions';
import '../sagas-v4.css';

export const dynamic='force-dynamic';
const poster=(p,w='w342')=>p?`https://image.tmdb.org/t/p/${w}${p}`:null;
const score=v=>v==null?'—':Number(v).toFixed(2);
const dateEs=v=>{if(!v)return null;try{return new Intl.DateTimeFormat('es-ES',{day:'2-digit',month:'short',year:'numeric'}).format(new Date(v))}catch{return null}};

function memberState(r){
  if(!r.in_catalog)return{label:'Fuera de PikoFilm',tone:'outside'};
  if(r.effective_status==='in_plex')return{label:'En Plex',tone:'owned'};
  if(r.availability_phase==='upcoming')return{label:'Próximamente',tone:'upcoming'};
  if(r.availability_phase==='cinema')return{label:'En cines',tone:'cinema'};
  return{label:'Sin Plex',tone:'missing'};
}

export default async function Saga({params}){
  const{name}=await params,s=await getSagaDetailV3(name);if(!s)notFound();
  const total=s.titles.length,catalog=s.titles.filter(x=>x.in_catalog),outside=s.titles.filter(x=>!x.in_catalog);
  const upcoming=catalog.filter(x=>x.availability_phase==='upcoming'&&x.effective_status!=='in_plex');
  const cinema=catalog.filter(x=>x.availability_phase==='cinema'&&x.effective_status!=='in_plex');
  const actionable=catalog.filter(x=>x.availability_phase==='available'||x.effective_status==='in_plex');
  const actionableTotal=actionable.length,inPlex=actionable.filter(x=>x.effective_status==='in_plex').length;
  const missing=actionable.filter(x=>x.effective_status!=='in_plex').length,pct=actionableTotal?Math.min(100,Math.round(inPlex/actionableTotal*100)):null;
  const scored=actionable.filter(x=>x.final_rating!=null),avg=scored.length?scored.reduce((a,x)=>a+Number(x.final_rating),0)/scored.length:null;
  const years=s.titles.map(x=>Number(x.year)).filter(Boolean),from=years.length?Math.min(...years):null,to=years.length?Math.max(...years):null;
  const collectionState=actionableTotal===0?'Sin títulos exigibles':missing===0?'Completa en Plex':inPlex===0?'Sin Plex':'Parcial en Plex';
  const collectionTone=actionableTotal===0?'empty':missing===0?'complete':inPlex?'partial':'empty';
  return <main className="sv4 sv4-detail">
    <div className="sv4-breadcrumbs"><Link href="/sagas">Sagas</Link><span>›</span><b>{s.name_clean}</b></div>

    <section className="sv4-detail-hero" style={s.backdrop_path?{'--sv4-bg':`url(${poster(s.backdrop_path,'w1280')})`}:undefined}>
      <div className="sv4-detail-shade"/>{poster(s.poster_path)&&<img className="sv4-detail-poster" src={poster(s.poster_path)} alt=""/>}
      <div className="sv4-detail-copy"><span className="sv4-eyebrow">Saga · PikoFilm</span><h1>{s.name_clean}</h1><p>{from&&to?`${from}–${to} · `:''}{catalog.length} títulos admitidos en PikoFilm · {total} miembros según TMDb.</p><div className="sv4-detail-status"><span className={`sv4-state ${collectionTone}`}>{collectionState}</span>{actionableTotal>0?<b>{inPlex}/{actionableTotal} exigibles en Plex</b>:<b>Ningún título exigible ahora</b>}{missing>0&&<span>{missing} sin Plex</span>}{cinema.length>0&&<span>{cinema.length} en cines</span>}{upcoming.length>0&&<span>{upcoming.length} próximas</span>}{outside.length>0&&<span>{outside.length} fuera de PikoFilm</span>}</div>{avg!=null&&<div className="sv4-detail-score"><span>PikoScore saga</span><strong>{score(avg)}</strong><small>{scored.length} obras exigibles valoradas</small></div>}<ActionButton action={refreshSagaCollectionAction} fields={{collectionId:name}} label="↻ Actualizar esta saga" pendingLabel="Actualizando…"/></div>
      <div className="sv4-detail-plex"><strong>{actionableTotal>0?`${inPlex}/${actionableTotal}`:'—'}</strong><span>{actionableTotal>0?'en Plex':'sin exigibles'}</span><small>{pct==null?'No aplica':`${pct}% físico`}</small></div>
    </section>

    <section className="sv4-detail-kpis"><div><span>EN PLEX</span><strong>{inPlex}</strong><small>presencia física</small></div><div><span>SIN PLEX</span><strong>{missing}</strong><small>exigibles ahora</small></div><div><span>EN CINES</span><strong>{cinema.length}</strong><small>no penalizan</small></div><div><span>PRÓXIMAMENTE</span><strong>{upcoming.length}</strong><small>no estrenadas</small></div><div><span>FUERA PIKOFILM</span><strong>{outside.length}</strong><small>descubrimiento</small></div><div><span>PIKOSCORE</span><strong>{score(avg)}</strong><small>solo obras exigibles</small></div></section>

    <section className="sv4-filmography"><div className="sv4-section-head"><div><span>COMPOSICIÓN CRONOLÓGICA</span><h2>Películas de la saga</h2></div><small>TMDb define miembros · PikoFilm decide catálogo · Plex indica presencia física</small></div>
      <div className="sv4-member-list">{s.titles.map((r,i)=>{const st=memberState(r),path=r.catalog_poster||r.poster_path,release=dateEs(r.release_date),canSend=!r.in_catalog&&/^tt\d+$/.test(String(r.external_imdb_id||'')),sent=canSend&&Boolean(r.novedades_status);return <article className={`sv4-member ${st.tone}`} key={`${r.tmdb_movie_id}-${i}`}>
        <div className="sv4-member-index">{String(i+1).padStart(2,'0')}</div>{poster(path,'w185')?<img src={poster(path,'w185')} alt=""/>:<div className="sv4-member-poster">—</div>}
        <div className="sv4-member-main"><span className={`sv4-state ${st.tone}`}>{st.label}</span><h3>{r.display_title||r.title}</h3><p>{r.year||'Año desconocido'}{release?` · estreno ${release}`:''}{r.resolution?` · ${r.resolution}`:''}</p>{r.availability_phase==='cinema'&&r.effective_status!=='in_plex'&&<small>Estreno reciente: se mantiene fuera del denominador durante la ventana doméstica conservadora.</small>}{r.availability_phase==='upcoming'&&<small>Aún no estrenada; no cuenta para completar físicamente la saga.</small>}{!r.in_catalog&&<small>TMDb la incluye en la colección, pero no está admitida en PikoFilm y no penaliza la completitud.</small>}</div>
        <div className="sv4-member-score">{r.in_catalog&&<><span>PikoScore</span><b>{score(r.final_rating)}</b></>}</div>
        <div className="sv4-member-action">{r.in_catalog&&r.imdb_id?<Link href={`/catalogo/${r.imdb_id}?from=${encodeURIComponent(`/sagas/${name}`)}`}>Abrir ficha →</Link>:sent?<Link href={`/novedades?q=${encodeURIComponent(r.external_imdb_id)}`}>✓ En Novedades →</Link>:canSend?<form action={addSagaMemberToNewsAction}><input type="hidden" name="imdbId" value={r.external_imdb_id}/><input type="hidden" name="tmdbMovieId" value={r.tmdb_movie_id}/><input type="hidden" name="title" value={r.title||''}/><input type="hidden" name="year" value={r.year||''}/><input type="hidden" name="returnTo" value={`/sagas/${name}`}/><button type="submit">+ Novedades</button></form>:<small>IMDb sin resolver</small>}</div>
      </article>})}</div>
    </section>

    <footer className="sv4-detail-footer"><div><span>ESTADO FÍSICO</span><strong>{collectionState}</strong><small>{actionableTotal===0?'No hay títulos exigibles actualmente; próximos estrenos y obras fuera de PikoFilm no penalizan.':missing===0?'Todos los títulos actualmente exigibles están en Plex.':`${missing} títulos admitidos y disponibles todavía no están en Plex.`}</small></div><Link href="/sagas">← Volver a Sagas</Link></footer>
  </main>;
}
