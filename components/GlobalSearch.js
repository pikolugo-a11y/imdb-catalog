'use client';

import Link from '@/components/NoPrefetchLink';
import {GLOBAL_SEARCH_MIN_TEXT,isGlobalSearchableTerm} from '@/lib/global-search-rules';
import {useRouter} from 'next/navigation';
import {useEffect,useMemo,useRef,useState} from 'react';

const empty={titles:[],people:[],sagas:[]};

export default function GlobalSearch(){
  const router=useRouter();
  const [q,setQ]=useState('');
  const [data,setData]=useState(empty);
  const [open,setOpen]=useState(false);
  const [loading,setLoading]=useState(false);
  const [error,setError]=useState('');
  const [mobileOpen,setMobileOpen]=useState(false);
  const [activeIndex,setActiveIndex]=useState(-1);
  const abortRef=useRef(null);
  const wrapRef=useRef(null);
  const inputRef=useRef(null);

  const options=useMemo(()=>[
    ...data.titles.map(x=>({key:`title:${x.imdb_id}`,group:'Títulos',href:`/catalogo/${x.imdb_id}`,title:x.display_title,meta:`${x.type||'Título'}${x.year?` · ${x.year}`:''} · ${x.imdb_id}`})),
    ...data.people.map(x=>({key:`person:${x.tmdb_person_id}`,group:'Personas',href:`/personas/${x.tmdb_person_id}`,title:x.name,meta:x.known_for_department||`TMDb ${x.tmdb_person_id}`})),
    ...data.sagas.map(x=>({key:`saga:${x.tmdb_collection_id}`,group:'Sagas',href:`/sagas/${x.tmdb_collection_id}`,title:x.name,meta:`${x.member_count} títulos · TMDb ${x.tmdb_collection_id}`}))
  ],[data]);

  useEffect(()=>{
    const onDown=e=>{if(wrapRef.current&&!wrapRef.current.contains(e.target)){setOpen(false);setMobileOpen(false);setActiveIndex(-1)}};
    const onKey=e=>{if(e.key==='Escape'){setOpen(false);setMobileOpen(false);setActiveIndex(-1)}};
    document.addEventListener('pointerdown',onDown);
    document.addEventListener('keydown',onKey);
    return()=>{document.removeEventListener('pointerdown',onDown);document.removeEventListener('keydown',onKey)};
  },[]);

  useEffect(()=>{
    const term=q.trim();setActiveIndex(-1);
    if(!isGlobalSearchableTerm(term)){abortRef.current?.abort();setData(empty);setError('');setLoading(false);setOpen(false);return;}
    const timer=setTimeout(async()=>{
      abortRef.current?.abort();
      const controller=new AbortController();abortRef.current=controller;
      setLoading(true);setError('');
      try{
        const res=await fetch(`/api/global-search?q=${encodeURIComponent(term.slice(0,100))}`,{signal:controller.signal,cache:'no-store'});
        if(!res.ok)throw new Error('search');
        setData(await res.json());setActiveIndex(-1);setOpen(true);
      }catch(e){if(e.name!=='AbortError'){setError('No se pudo buscar ahora.');setOpen(true)}}
      finally{if(!controller.signal.aborted)setLoading(false)}
    },180);
    return()=>clearTimeout(timer);
  },[q]);

  const hasResults=options.length>0;
  const term=q.trim(),searchable=isGlobalSearchableTerm(term),needsMore=Boolean(term&&!searchable);
  const close=()=>{setOpen(false);setMobileOpen(false);setActiveIndex(-1)};
  const openMobile=()=>{setMobileOpen(true);setOpen(searchable);requestAnimationFrame(()=>inputRef.current?.focus())};
  const onInputKeyDown=e=>{
    if(!open||!options.length)return;
    if(e.key==='ArrowDown'){e.preventDefault();setActiveIndex(i=>i<options.length-1?i+1:0);}
    else if(e.key==='ArrowUp'){e.preventDefault();setActiveIndex(i=>i>0?i-1:options.length-1);}
    else if(e.key==='Enter'&&activeIndex>=0){e.preventDefault();const target=options[activeIndex];close();router.push(target.href);}
    else if(e.key==='Home'){e.preventDefault();setActiveIndex(0);}
    else if(e.key==='End'){e.preventDefault();setActiveIndex(options.length-1);}
  };
  let cursor=0;

  return <div ref={wrapRef} className={`v4-global-search ${mobileOpen?'mobile-open':''}`}>
    <button type="button" className="v4-search-mobile-trigger" aria-label="Buscar en PikoFilm" onClick={openMobile}>⌕</button>
    <div className="v4-search-box">
      <span aria-hidden="true">⌕</span>
      <input ref={inputRef} value={q} onChange={e=>setQ(e.target.value)} onFocus={()=>searchable&&setOpen(true)} onKeyDown={onInputKeyDown} placeholder="Buscar en PikoFilm…" aria-label="Buscar títulos, personas y sagas" aria-describedby={needsMore?'v4-search-hint':undefined} role="combobox" aria-autocomplete="list" aria-expanded={open&&searchable} aria-controls="v4-search-listbox" aria-activedescendant={activeIndex>=0?`v4-search-option-${activeIndex}`:undefined} autoComplete="off" maxLength={100}/>
      {loading&&<span className="v4-search-loading" aria-label="Buscando">…</span>}
      {mobileOpen&&<button type="button" className="v4-search-close" aria-label="Cerrar búsqueda" onClick={close}>×</button>}
    </div>
    {needsMore&&<div id="v4-search-hint" className="v4-search-hint" role="status">Escribe al menos {GLOBAL_SEARCH_MIN_TEXT} caracteres, salvo un IMDb o ID numérico exacto.</div>}
    {open&&searchable&&<div id="v4-search-listbox" className="v4-search-results" role="listbox" aria-label="Resultados de búsqueda">
      {error?<div className="v4-search-state error" role="status">{error}</div>:hasResults?<>
        {['Títulos','Personas','Sagas'].map(group=>{const rows=options.filter(x=>x.group===group);if(!rows.length)return null;const start=cursor;cursor+=rows.length;return <SearchGroup title={group} key={group}>{rows.map((x,i)=>{const index=start+i;return <Result key={x.key} id={`v4-search-option-${index}`} href={x.href} onClick={close} onMouseEnter={()=>setActiveIndex(index)} title={x.title} meta={x.meta} active={activeIndex===index}/>} )}</SearchGroup>})}
      </>:!loading&&<div className="v4-search-state" role="status"><strong>Sin resultados en PikoFilm</strong><Link href="/novedades" onClick={close}>+ Añadir candidato</Link></div>}
    </div>}
  </div>;
}

function SearchGroup({title,children}){return <section className="v4-search-group" role="group" aria-label={title}><h3>{title}</h3>{children}</section>}
function Result({id,href,title,meta,onClick,onMouseEnter,active}){return <Link id={id} role="option" aria-selected={active} className={`v4-search-result ${active?'active':''}`} href={href} onClick={onClick} onMouseEnter={onMouseEnter}><span><b>{title}</b><small>{meta}</small></span><span aria-hidden="true">→</span></Link>}
