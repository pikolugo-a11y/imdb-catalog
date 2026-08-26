'use client';

import {useState} from 'react';
import {useRouter,useSearchParams} from 'next/navigation';

export default function SeriesSearch({initial=''}){
  const router=useRouter();
  const current=useSearchParams();
  const [q,setQ]=useState(initial);
  function apply(value=q){
    const p=new URLSearchParams(current.toString());
    const clean=String(value||'').trim();
    if(clean)p.set('q',clean);else p.delete('q');
    p.delete('page');
    router.push('/calidad/series'+(p.toString()?`?${p.toString()}`:''));
  }
  return <div className="series-search" role="search">
    <span aria-hidden="true">⌕</span>
    <input value={q} onChange={e=>setQ(e.target.value)} onKeyDown={e=>{if(e.key==='Enter')apply()}} placeholder="Buscar por título…" aria-label="Buscar por título"/>
    {q&&<button type="button" className="series-search-clear" onClick={()=>{setQ('');apply('')}} aria-label="Limpiar búsqueda">×</button>}
  </div>;
}
