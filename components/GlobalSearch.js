'use client';

import Link from 'next/link';
import {useEffect,useRef,useState} from 'react';

const empty={titles:[],people:[],sagas:[]};

export default function GlobalSearch(){
  const [q,setQ]=useState('');
  const [data,setData]=useState(empty);
  const [open,setOpen]=useState(false);
  const [loading,setLoading]=useState(false);
  const [error,setError]=useState('');
  const [mobileOpen,setMobileOpen]=useState(false);
  const abortRef=useRef(null);
  const wrapRef=useRef(null);

  useEffect(()=>{
    const onDown=e=>{if(wrapRef.current&&!wrapRef.current.contains(e.target)){setOpen(false);setMobileOpen(false)}};
    document.addEventListener('pointerdown',onDown);
    return()=>document.removeEventListener('pointerdown',onDown);
  },[]);

  useEffect(()=>{
    const term=q.trim();
    if(!term){abortRef.current?.abort();setData(empty);setError('');setLoading(false);return;}
    const timer=setTimeout(async()=>{
      abortRef.current?.abort();
      const controller=new AbortController();abortRef.current=controller;
      setLoading(true);setError('');
      try{
        const res=await fetch(`/api/global-search?q=${encodeURIComponent(term)}`,{signal:controller.signal,cache:'no-store'});
        if(!res.ok)throw new Error('search');
        setData(await res.json());setOpen(true);
      }catch(e){if(e.name!=='AbortError'){setError('No se pudo completar la búsqueda.');setOpen(true)}}
      finally{if(!controller.signal.aborted)setLoading(false)}
    },180);
    return()=>clearTimeout(timer);
  },[q]);

  const hasResults=data.titles.length||data.people.length||data.sagas.length;
  const close=()=>{setOpen(false);setMobileOpen(false)};

  return <div ref={wrapRef} className={`v4-global-search ${mobileOpen?'mobile-open':''}`}>
    <button type="button" className="v4-search-mobile-trigger" aria-label="Buscar en PikoFilm" onClick={()=>{setMobileOpen(true);setOpen(Boolean(q.trim()))}}>⌕</button>
    <div className="v4-search-box">
      <span aria-hidden="true">⌕</span>
      <input value={q} onChange={e=>setQ(e.target.value)} onFocus={()=>q.trim()&&setOpen(true)} placeholder="Buscar en PikoFilm…" aria-label="Buscar títulos, personas y sagas" autoComplete="off"/>
      {loading&&<span className="v4-search-loading" aria-label="Buscando">…</span>}
      {mobileOpen&&<button type="button" className="v4-search-close" aria-label="Cerrar búsqueda" onClick={()=>{setMobileOpen(false);setOpen(false)}}>×</button>}
    </div>
    {open&&q.trim()&&<div className="v4-search-results" role="dialog" aria-label="Resultados de búsqueda">
      {error?<div className="v4-search-state error">{error}</div>:hasResults?<>
        {data.titles.length>0&&<SearchGroup title="Títulos">{data.titles.map(x=><Result key={x.imdb_id} href={`/catalogo/${x.imdb_id}`} onClick={close} title={x.display_title} meta={`${x.type||'Título'}${x.year?` · ${x.year}`:''} · ${x.imdb_id}`}/>)}</SearchGroup>}
        {data.people.length>0&&<SearchGroup title="Personas">{data.people.map(x=><Result key={x.tmdb_person_id} href={`/personas/${x.tmdb_person_id}`} onClick={close} title={x.name} meta={x.known_for_department||`TMDb ${x.tmdb_person_id}`}/>)}</SearchGroup>}
        {data.sagas.length>0&&<SearchGroup title="Sagas">{data.sagas.map(x=><Result key={x.tmdb_collection_id} href={`/sagas/${x.tmdb_collection_id}`} onClick={close} title={x.name} meta={`${x.member_count} títulos · TMDb ${x.tmdb_collection_id}`}/>)}</SearchGroup>}
      </>:!loading&&<div className="v4-search-state"><strong>Sin resultados en PikoFilm</strong><Link href={`/novedades?candidate=${encodeURIComponent(q.trim())}`} onClick={close}>+ Añadir candidato</Link></div>}
    </div>}
  </div>;
}

function SearchGroup({title,children}){return <section className="v4-search-group"><h3>{title}</h3>{children}</section>}
function Result({href,title,meta,onClick}){return <Link className="v4-search-result" href={href} onClick={onClick}><span><b>{title}</b><small>{meta}</small></span><span aria-hidden="true">→</span></Link>}
