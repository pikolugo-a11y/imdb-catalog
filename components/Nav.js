'use client';

import Link from 'next/link';
import {usePathname} from 'next/navigation';
import {useEffect,useState} from 'react';

const desktopItems=[
  ['/','Inicio','⌂'],
  ['/catalogo','Catálogo','▦'],
  ['/personas','Personas','♙'],
  ['/novedades','Novedades','✦'],
  ['/calidad','Calidad','✓'],
  ['/admin','Operaciones','⚙'],
];

const mobileItems=desktopItems.slice(0,4);
const secondaryItems=[['/calidad','Calidad','✓'],['/admin','Operaciones','⚙']];
const qualityItems=[['/calidad/identidad','Identidad'],['/calidad/validacion-identidad','Validación de identidad'],['/calidad/datos','Datos principales'],['/calidad/peliculas','Películas'],['/calidad/series','Series'],['/calidad/personas','Personas'],['/calidad/pikoquality','PikoQuality'],['/calidad/sin-estado','Recuperación Lifecycle']];

function sectionLabel(path){
  const quality=qualityItems.find(([href])=>path.startsWith(href));
  if(quality)return `Calidad · ${quality[1]}`;
  if(path.startsWith('/sagas'))return 'Catálogo · Sagas';
  if(path.startsWith('/plex'))return 'Novedades';
  const item=desktopItems.find(([href])=>href==='/'?path==='/':path.startsWith(href));
  return item?.[1]||'PikoFilm';
}

export default function Nav(){
  const path=usePathname();
  const [moreOpen,setMoreOpen]=useState(false);
  const active=href=>href==='/'?path==='/':path.startsWith(href);
  const current=sectionLabel(path);
  const inQuality=path.startsWith('/calidad');
  const moreActive=inQuality||path.startsWith('/admin')||path.startsWith('/sagas');

  useEffect(()=>setMoreOpen(false),[path]);

  return <>
    <aside className="v4-sidebar" aria-label="Navegación principal">
      <Link href="/" className="v4-brand" aria-label="PikoFilm - Inicio">
        <span className="v4-brand-mark">P</span>
        <span className="v4-brand-copy"><b>PikoFilm</b><small>Biblioteca personal</small></span>
      </Link>
      <nav className="v4-side-nav">
        {desktopItems.map(([href,label,icon])=><div key={href} className={href==='/calidad'&&inQuality?'v4-nav-group open':'v4-nav-group'}>
          <Link href={href} className={active(href)?'active':''} aria-current={active(href)?'page':undefined}><span className="v4-nav-icon">{icon}</span><span>{label}</span></Link>
          {href==='/catalogo'&&<Link href="/sagas" className={path.startsWith('/sagas')?'v4-catalog-subitem active':'v4-catalog-subitem'} aria-current={path.startsWith('/sagas')?'page':undefined}>Sagas</Link>}
          {href==='/calidad'&&inQuality&&<div className="v4-quality-subnav">{qualityItems.map(([h,l])=><Link key={h} href={h} className={path.startsWith(h)?'active':''} aria-current={path.startsWith(h)?'page':undefined}>{l}</Link>)}</div>}
        </div>)}
      </nav>
    </aside>

    <header className="v4-header">
      <strong>{current}</strong>
      <div className="v4-search-placeholder" aria-label="Buscador global pendiente de conexión"><span aria-hidden="true">⌕</span><span>Buscar en PikoFilm…</span></div>
    </header>

    <nav className="v4-mobile-nav" aria-label="Navegación principal móvil">
      {mobileItems.map(([href,label,icon])=><Link key={href} href={href} className={active(href)?'active':''} aria-current={active(href)?'page':undefined}><span>{icon}</span><small>{label}</small></Link>)}
      <button type="button" className={moreActive||moreOpen?'active':''} aria-expanded={moreOpen} aria-controls="v4-more-menu" onClick={()=>setMoreOpen(v=>!v)}><span>•••</span><small>Más</small></button>
    </nav>

    {moreOpen&&<div className="v4-more-backdrop" onClick={()=>setMoreOpen(false)}><div id="v4-more-menu" className="v4-more-menu" role="menu" onClick={event=>event.stopPropagation()}>
      <strong>Más</strong>
      {secondaryItems.map(([href,label,icon])=><Link role="menuitem" key={href} href={href} className={active(href)?'active':''}><span>{icon}</span>{label}</Link>)}
    </div></div>}
  </>;
}
