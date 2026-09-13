'use client';
import {useEffect,useMemo,useState} from 'react';
import {usePathname,useRouter,useSearchParams} from 'next/navigation';

function nextUrl(path,sp,patch){const p=new URLSearchParams(sp.toString());for(const[k,v]of Object.entries(patch)){if(v==null||v===''||(Array.isArray(v)&&!v.length))p.delete(k);else p.set(k,Array.isArray(v)?v.join(','):String(v));}p.delete('page');const q=p.toString();return `${path}${q?`?${q}`:''}`}

export default function CatalogFiltersV4({genres=[],invalidYearRange=false}){
  const router=useRouter(),path=usePathname(),sp=useSearchParams();
  const [q,setQ]=useState(sp.get('q')||''),[yf,setYf]=useState(sp.get('yearFrom')||''),[yt,setYt]=useState(sp.get('yearTo')||'');
  const selected=useMemo(()=>new Set((sp.get('genres')||'').split(',').filter(Boolean)),[sp]);
  useEffect(()=>{setQ(sp.get('q')||'');setYf(sp.get('yearFrom')||'');setYt(sp.get('yearTo')||'')},[sp]);
  useEffect(()=>{const t=setTimeout(()=>{if(q!==(sp.get('q')||''))router.replace(nextUrl(path,sp,{q:q.trim()}),{scroll:false})},260);return()=>clearTimeout(t)},[q,path,router,sp]);
  useEffect(()=>{const t=setTimeout(()=>{const a=yf.trim(),b=yt.trim();if(a!==(sp.get('yearFrom')||'')||b!==(sp.get('yearTo')||''))router.replace(nextUrl(path,sp,{yearFrom:a,yearTo:b}),{scroll:false})},320);return()=>clearTimeout(t)},[yf,yt,path,router,sp]);
  const apply=patch=>router.replace(nextUrl(path,sp,patch),{scroll:false});
  const toggleGenre=g=>{const x=new Set(selected);x.has(g)?x.delete(g):x.add(g);apply({genres:[...x]});};
  const clear=()=>{const p=new URLSearchParams(sp.toString());['q','plex','genres','genreMode','yearFrom','yearTo','country','page','status','genre','sort','dir'].forEach(k=>p.delete(k));router.replace(`${path}${p.toString()?`?${p}`:''}`,{scroll:false});};
  const country=sp.get('country')||'',scope=sp.get('scope')||'all',plex=sp.get('plex')||'all',series=scope==='series',defaultSort=series&&plex==='without_plex'?'spain':'score',sort=sp.get('sort')||defaultSort;
  const active=Boolean(sp.get('q')||sp.get('plex')||sp.get('genres')||sp.get('yearFrom')||sp.get('yearTo')||country);
  const changeSort=value=>apply({sort:value===defaultSort?null:value,dir:value==='title'?'asc':null});
  return <section className="cv4-filters" aria-label="Filtros del catálogo">
    <label className="cv4-search"><span>Buscar en catálogo</span><div><span aria-hidden="true">⌕</span><input value={q} onChange={e=>setQ(e.target.value)} placeholder="Título, título original o tt…"/></div></label>
    <label><span>Plex</span><select value={plex} onChange={e=>apply({plex:e.target.value==='all'?null:e.target.value,sort:null,dir:null})}><option value="all">Todos</option><option value="in_plex">En Plex</option><option value="without_plex">Sin Plex</option></select></label>
    <label><span>Orden</span><select value={sort} onChange={e=>changeSort(e.target.value)}>{series&&<option value="spain">Prioridad España</option>}<option value="score">PikoScore</option><option value="year">Año</option><option value="title">Título</option></select></label>
    <details className="cv4-genres"><summary><span>Géneros</span><b>{selected.size?`${selected.size} seleccionados`:'Todos'}</b></summary><div className="cv4-genre-pop"><div className="cv4-mode"><button type="button" className={(sp.get('genreMode')||'any')==='any'?'active':''} onClick={()=>apply({genreMode:null})}>Cualquiera</button><button type="button" className={sp.get('genreMode')==='all'?'active':''} onClick={()=>apply({genreMode:'all'})}>Todos</button></div><div className="cv4-genre-list">{genres.map(g=><label key={g}><input type="checkbox" checked={selected.has(g)} onChange={()=>toggleGenre(g)}/><span>{g}</span></label>)}</div></div></details>
    <div className={`cv4-year ${invalidYearRange?'invalid':''}`}><span>Año</span><div><input inputMode="numeric" value={yf} onChange={e=>setYf(e.target.value.replace(/\D/g,'').slice(0,4))} placeholder="Desde" aria-invalid={invalidYearRange}/><i>—</i><input inputMode="numeric" value={yt} onChange={e=>setYt(e.target.value.replace(/\D/g,'').slice(0,4))} placeholder="Hasta" aria-invalid={invalidYearRange}/></div>{invalidYearRange&&<small>El año inicial no puede ser posterior al final.</small>}</div>
    {country&&<div className="cv4-year"><span>País</span><div><b>{country}</b></div></div>}
    {active&&<button type="button" className="cv4-clear" onClick={clear}>Limpiar filtros</button>}
  </section>;
}