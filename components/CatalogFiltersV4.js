'use client';
import {useEffect,useMemo,useState} from 'react';
import {usePathname,useRouter,useSearchParams} from 'next/navigation';

function nextUrl(path,sp,patch){
  const p=new URLSearchParams(sp.toString());
  for(const[k,v]of Object.entries(patch)){
    if(v==null||v===''||(Array.isArray(v)&&!v.length))p.delete(k);
    else p.set(k,Array.isArray(v)?v.join(','):String(v));
  }
  p.delete('page');
  const q=p.toString();return `${path}${q?`?${q}`:''}`;
}

const includes=(value,term)=>String(value||'').toLocaleLowerCase('es').includes(String(term||'').trim().toLocaleLowerCase('es'));

export default function CatalogFiltersV4({genres=[],countries=[],invalidYearRange=false}){
  const router=useRouter(),path=usePathname(),sp=useSearchParams();
  const [q,setQ]=useState(sp.get('q')||'');
  const [yf,setYf]=useState(sp.get('yearFrom')||'');
  const [yt,setYt]=useState(sp.get('yearTo')||'');
  const [countrySearch,setCountrySearch]=useState('');
  const [genreSearch,setGenreSearch]=useState('');

  const selectedGenres=useMemo(()=>new Set((sp.get('genres')||'').split(',').filter(Boolean)),[sp]);
  const selectedCountries=useMemo(()=>new Set((sp.get('countries')||sp.get('country')||'').split(',').filter(Boolean)),[sp]);
  const visibleCountries=useMemo(()=>countries.filter(c=>includes(c,countrySearch)),[countries,countrySearch]);
  const visibleGenres=useMemo(()=>genres.filter(g=>includes(g,genreSearch)),[genres,genreSearch]);

  useEffect(()=>{setQ(sp.get('q')||'');setYf(sp.get('yearFrom')||'');setYt(sp.get('yearTo')||'')},[sp]);
  useEffect(()=>{const t=setTimeout(()=>{if(q!==(sp.get('q')||''))router.replace(nextUrl(path,sp,{q:q.trim()}),{scroll:false})},260);return()=>clearTimeout(t)},[q,path,router,sp]);
  useEffect(()=>{const t=setTimeout(()=>{const a=yf.trim(),b=yt.trim();if(a!==(sp.get('yearFrom')||'')||b!==(sp.get('yearTo')||''))router.replace(nextUrl(path,sp,{yearFrom:a,yearTo:b}),{scroll:false})},320);return()=>clearTimeout(t)},[yf,yt,path,router,sp]);

  const apply=patch=>router.replace(nextUrl(path,sp,patch),{scroll:false});
  const toggleGenre=g=>{const x=new Set(selectedGenres);x.has(g)?x.delete(g):x.add(g);apply({genres:[...x]});};
  const toggleCountry=c=>{const x=new Set(selectedCountries);x.has(c)?x.delete(c):x.add(c);apply({countries:[...x],country:null});};
  const removeGenre=g=>{const x=new Set(selectedGenres);x.delete(g);apply({genres:[...x]});};
  const removeCountry=c=>{const x=new Set(selectedCountries);x.delete(c);apply({countries:[...x],country:null});};
  const clearQuery=()=>{setQ('');apply({q:null});};
  const clearYears=()=>{setYf('');setYt('');apply({yearFrom:null,yearTo:null});};
  const clear=()=>{
    setQ('');setYf('');setYt('');
    const p=new URLSearchParams(sp.toString());
    ['q','plex','genres','genreMode','countries','country','countryMode','yearFrom','yearTo','page','status','genre','sort','dir'].forEach(k=>p.delete(k));
    router.replace(`${path}${p.toString()?`?${p}`:''}`,{scroll:false});
  };

  const plex=sp.get('plex')||'all';
  const active=Boolean(sp.get('q')||sp.get('plex')||sp.get('genres')||sp.get('countries')||sp.get('country')||sp.get('yearFrom')||sp.get('yearTo'));
  const yearLabel=yf&&yt?`${yf}–${yt}`:yf?`Desde ${yf}`:yt?`Hasta ${yt}`:'';

  return <section className="cv4-filters" aria-label="Filtros del catálogo">
    <label className="cv4-search"><span>Buscar en catálogo</span><div><span aria-hidden="true">⌕</span><input value={q} onChange={e=>setQ(e.target.value)} placeholder="Título, título original o tt…"/></div></label>

    <details className="cv4-multi cv4-countries">
      <summary><span>País</span><b>{selectedCountries.size?selectedCountries.size===1?[...selectedCountries][0]:`${selectedCountries.size} seleccionados`:'Todos'}</b></summary>
      <div className="cv4-multi-pop">
        <input className="cv4-option-search" value={countrySearch} onChange={e=>setCountrySearch(e.target.value)} placeholder="Buscar país…" aria-label="Buscar país"/>
        <div className="cv4-mode"><button type="button" className={(sp.get('countryMode')||'any')==='any'?'active':''} onClick={()=>apply({countryMode:null})}>Cualquiera</button><button type="button" className={sp.get('countryMode')==='all'?'active':''} onClick={()=>apply({countryMode:'all'})}>Todos</button></div>
        <div className="cv4-multi-list">{visibleCountries.map(c=><label key={c}><input type="checkbox" checked={selectedCountries.has(c)} onChange={()=>toggleCountry(c)}/><span>{c}</span></label>)}{!visibleCountries.length&&<small className="cv4-option-empty">Sin coincidencias</small>}</div>
      </div>
    </details>

    <details className="cv4-multi cv4-genres">
      <summary><span>Géneros</span><b>{selectedGenres.size?`${selectedGenres.size} seleccionados`:'Todos'}</b></summary>
      <div className="cv4-multi-pop">
        <input className="cv4-option-search" value={genreSearch} onChange={e=>setGenreSearch(e.target.value)} placeholder="Buscar género…" aria-label="Buscar género"/>
        <div className="cv4-mode"><button type="button" className={(sp.get('genreMode')||'any')==='any'?'active':''} onClick={()=>apply({genreMode:null})}>Cualquiera</button><button type="button" className={sp.get('genreMode')==='all'?'active':''} onClick={()=>apply({genreMode:'all'})}>Todos</button></div>
        <div className="cv4-multi-list">{visibleGenres.map(g=><label key={g}><input type="checkbox" checked={selectedGenres.has(g)} onChange={()=>toggleGenre(g)}/><span>{g}</span></label>)}{!visibleGenres.length&&<small className="cv4-option-empty">Sin coincidencias</small>}</div>
      </div>
    </details>

    <div className={`cv4-year ${invalidYearRange?'invalid':''}`}><span>Año</span><div><input inputMode="numeric" value={yf} onChange={e=>setYf(e.target.value.replace(/\D/g,'').slice(0,4))} placeholder="Desde" aria-invalid={invalidYearRange}/><i>—</i><input inputMode="numeric" value={yt} onChange={e=>setYt(e.target.value.replace(/\D/g,'').slice(0,4))} placeholder="Hasta" aria-invalid={invalidYearRange}/></div>{invalidYearRange&&<small>El año inicial no puede ser posterior al final.</small>}</div>

    {active&&<button type="button" className="cv4-clear" onClick={clear}>Limpiar filtros</button>}

    {active&&<div className="cv4-active-filters" aria-label="Filtros activos">
      <span className="cv4-active-label">Filtros activos</span>
      {q&&<button type="button" onClick={clearQuery}><span>Buscar:</span> {q} <b>×</b></button>}
      {plex!=='all'&&<button type="button" onClick={()=>apply({plex:null})}><span>Plex:</span> {plex==='in_plex'?'En Plex':'Sin Plex'} <b>×</b></button>}
      {[...selectedCountries].map(c=><button type="button" key={`country-${c}`} onClick={()=>removeCountry(c)}><span>País:</span> {c} <b>×</b></button>)}
      {[...selectedGenres].map(g=><button type="button" key={`genre-${g}`} onClick={()=>removeGenre(g)}><span>Género:</span> {g} <b>×</b></button>)}
      {yearLabel&&<button type="button" onClick={clearYears}><span>Año:</span> {yearLabel} <b>×</b></button>}
    </div>}
  </section>;
}
