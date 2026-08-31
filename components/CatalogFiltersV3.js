'use client';

import {useMemo,useState} from 'react';
import {useRouter,useSearchParams} from 'next/navigation';

const TYPE=[['','Todos'],['movie','Películas'],['series','Series']];
const STATUS=[['','Todos'],['missing','Faltan'],['in_plex','En Plex']];

export default function CatalogFiltersV3({genres,minYear,maxYear,initial={}}){
  const router=useRouter();
  const current=useSearchParams();
  const [q,setQ]=useState(initial.q||'');
  const [type,setType]=useState(initial.type||'');
  const [status,setStatus]=useState(initial.status==='acquiring'?'missing':initial.status||'');
  const [selectedGenres,setSelectedGenres]=useState(initial.genres||[]);
  const [genreMode,setGenreMode]=useState(initial.genreMode||'any');
  const [genreSearch,setGenreSearch]=useState('');
  const [yearFrom,setYearFrom]=useState(initial.yearFrom||'');
  const [yearTo,setYearTo]=useState(initial.yearTo||'');
  const [open,setOpen]=useState(null);

  const visibleGenres=useMemo(()=>{
    const s=genreSearch.trim().toLocaleLowerCase('es');
    const sorted=[...genres].sort((a,b)=>{
      const aa=selectedGenres.includes(a)?0:1,bb=selectedGenres.includes(b)?0:1;
      return aa-bb||a.localeCompare(b,'es');
    });
    return s?sorted.filter(g=>g.toLocaleLowerCase('es').includes(s)):sorted;
  },[genres,genreSearch,selectedGenres]);

  function toggleGenre(g){setSelectedGenres(xs=>xs.includes(g)?xs.filter(x=>x!==g):[...xs,g].slice(0,12))}
  function apply(overrides={}){
    const p=new URLSearchParams(current.toString());
    const values={q,type,status,genres:selectedGenres.join(','),genreMode:genreMode==='all'?'all':'',yearFrom,yearTo,...overrides};
    for(const[k,v]of Object.entries(values)){if(v===undefined)continue;if(v===null||v==='')p.delete(k);else p.set(k,String(v))}
    p.delete('genre');p.delete('year');p.delete('page');
    router.push('/catalogo'+(p.toString()?`?${p.toString()}`:''));
    setOpen(null);
  }
  function clear(){router.push('/catalogo'+(current.get('view')?`?view=${current.get('view')}`:''))}
  function setQuick(kind,value){kind==='type'?setType(value):setStatus(value);apply({[kind]:value})}
  const activeCount=(type?1:0)+(status?1:0)+selectedGenres.length+(yearFrom||yearTo?1:0)+(q?1:0);

  return <section className="catalog-filter-v3" aria-label="Filtros del catálogo">
    <div className="catalog-search-v3">
      <span aria-hidden="true">⌕</span>
      <input value={q} onChange={e=>setQ(e.target.value)} onKeyDown={e=>{if(e.key==='Enter')apply()}} placeholder="Buscar por título…" aria-label="Buscar por título"/>
      {q&&<button type="button" className="catalog-search-clear" onClick={()=>{setQ('');apply({q:''})}}>×</button>}
    </div>

    <div className="catalog-filter-row-v3">
      <div className="catalog-quickset"><span>Tipo</span>{TYPE.map(([v,l])=><button type="button" key={v||'all'} className={type===v?'active':''} onClick={()=>setQuick('type',v)}>{l}</button>)}</div>
      <div className="catalog-quickset"><span>Estado</span>{STATUS.map(([v,l])=><button type="button" key={v||'all'} className={status===v?'active':''} onClick={()=>setQuick('status',v)}>{l}</button>)}</div>

      <div className="catalog-popover-wrap">
        <button type="button" className={selectedGenres.length?'catalog-filter-trigger active':'catalog-filter-trigger'} onClick={()=>setOpen(open==='genres'?null:'genres')}>
          <span>Géneros</span><b>{selectedGenres.length?`${selectedGenres.length} seleccionados`:'Todos'}</b><i>⌄</i>
        </button>
        {open==='genres'&&<div className="catalog-popover genres">
          <div className="catalog-popover-head"><b>Géneros</b><button type="button" onClick={()=>setOpen(null)}>×</button></div>
          <input className="catalog-popover-search" value={genreSearch} onChange={e=>setGenreSearch(e.target.value)} placeholder="Buscar género…" autoFocus/>
          {selectedGenres.length>0&&<div className="catalog-selected-chips">{selectedGenres.map(g=><button type="button" key={g} onClick={()=>toggleGenre(g)}>{g} ×</button>)}</div>}
          <div className="catalog-genre-list">{visibleGenres.map(g=><label key={g}><input type="checkbox" checked={selectedGenres.includes(g)} onChange={()=>toggleGenre(g)}/><span>{g}</span></label>)}</div>
          <div className="catalog-mode"><span>Coincidencia</span><button type="button" className={genreMode==='any'?'active':''} onClick={()=>setGenreMode('any')}>Cualquiera</button><button type="button" className={genreMode==='all'?'active':''} onClick={()=>setGenreMode('all')}>Todos</button></div>
          <div className="catalog-popover-actions"><button type="button" onClick={()=>setSelectedGenres([])}>Limpiar</button><button type="button" className="primary" onClick={()=>apply()}>Aplicar</button></div>
        </div>}
      </div>

      <div className="catalog-popover-wrap">
        <button type="button" className={yearFrom||yearTo?'catalog-filter-trigger active':'catalog-filter-trigger'} onClick={()=>setOpen(open==='years'?null:'years')}>
          <span>Año</span><b>{yearFrom||yearTo?`${yearFrom||minYear} – ${yearTo||maxYear}`:'Todos'}</b><i>⌄</i>
        </button>
        {open==='years'&&<div className="catalog-popover years">
          <div className="catalog-popover-head"><b>Rango de años</b><button type="button" onClick={()=>setOpen(null)}>×</button></div>
          <div className="catalog-year-inputs"><label>Desde<input type="number" min={minYear} max={maxYear} value={yearFrom} onChange={e=>setYearFrom(e.target.value)}/></label><span>→</span><label>Hasta<input type="number" min={minYear} max={maxYear} value={yearTo} onChange={e=>setYearTo(e.target.value)}/></label></div>
          <div className="catalog-decade-shortcuts">{[2020,2010,2000,1990,1980,1970,1960,1950].filter(y=>y<=maxYear&&y+9>=minYear).map(y=><button type="button" key={y} onClick={()=>{setYearFrom(String(Math.max(y,minYear)));setYearTo(String(Math.min(y+9,maxYear)))}}>{y}s</button>)}</div>
          <div className="catalog-popover-actions"><button type="button" onClick={()=>{setYearFrom('');setYearTo('')}}>Limpiar</button><button type="button" className="primary" onClick={()=>apply()}>Aplicar</button></div>
        </div>}
      </div>

      <button type="button" className="catalog-apply-compact" onClick={()=>apply()}>Aplicar</button>
      {activeCount>0&&<button type="button" className="catalog-clear-all" onClick={clear}>Limpiar <span>{activeCount}</span></button>}
    </div>
  </section>;
}
