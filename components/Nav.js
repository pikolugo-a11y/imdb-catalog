'use client';

import Link from '@/components/NoPrefetchLink';
import {usePathname} from 'next/navigation';
import {useEffect,useRef,useState} from 'react';
import GlobalSearch from './GlobalSearch';

const desktopItems=[
  ['/','Inicio','⌂'],
  ['/catalogo','Catálogo','▦'],
  ['/personas','Personas','♙'],
  ['/novedades','Novedades','✦'],
  ['/calidad','Calidad','✓'],
  ['/actividad','Actividad','◷'],
  ['/admin','Operaciones','⚙'],
];

const mobileItems=desktopItems.slice(0,4);
const secondaryItems=[['/sagas','Sagas','◈'],['/calidad','Calidad','✓'],['/actividad','Actividad','◷'],['/admin','Operaciones','⚙']];
const qualityPrimaryItems=[
  ['/calidad/centro','Centro de Calidad'],
  ['/calidad/peliculas','Películas'],
  ['/calidad/series','Series'],
];
const qualitySectionLabels=[
  ['/calidad/centro','Centro de Calidad'],
  ['/calidad/identidad','Centro · Identidad'],
  ['/calidad/validacion-identidad','Centro · Validación'],
  ['/calidad/datos','Centro · Datos'],
  ['/calidad/personas','Centro · Personas'],
  ['/calidad/pikoquality','Centro · PikoQuality'],
  ['/calidad/sin-estado','Centro · Integridad Lifecycle'],
  ['/calidad/peliculas','Películas'],
  ['/calidad/series','Series'],
];

function sectionLabel(path){
  const quality=qualitySectionLabels.find(([href])=>path.startsWith(href));
  if(quality)return `Calidad · ${quality[1]}`;
  if(path.startsWith('/sagas'))return 'Catálogo · Sagas';
  if(path.startsWith('/plex'))return 'Novedades';
  const item=desktopItems.find(([href])=>href==='/'?path==='/':path.startsWith(href));
  return item?.[1]||'PikoFilm';
}

export default function Nav(){
  const path=usePathname();
  const [moreOpen,setMoreOpen]=useState(false);
  const moreButtonRef=useRef(null);
  const active=href=>href==='/'?path==='/':path.startsWith(href);
  const current=sectionLabel(path);
  const inQuality=path.startsWith('/calidad');
  const moreActive=inQuality||path.startsWith('/actividad')||path.startsWith('/admin')||path.startsWith('/sagas');
  const qualityActive=href=>{
    if(href==='/calidad/centro')return path.startsWith('/calidad/centro')||['/calidad/identidad','/calidad/validacion-identidad','/calidad/datos','/calidad/personas','/calidad/pikoquality','/calidad/sin-estado'].some(p=>path.startsWith(p));
    return path.startsWith(href);
  };

  useEffect(()=>setMoreOpen(false),[path]);
  useEffect(()=>{
    if(!moreOpen)return undefined;
    const onKeyDown=event=>{
      if(event.key!=='Escape')return;
      event.preventDefault();
      setMoreOpen(false);
      requestAnimationFrame(()=>moreButtonRef.current?.focus());
    };
    document.addEventListener('keydown',onKeyDown);
    return()=>document.removeEventListener('keydown',onKeyDown);
  },[moreOpen]);

  return <>
    <aside className="v4-sidebar" aria-label="Navegación principal">
      <Link prefetch={false} href="/" className="v4-brand" aria-label="PikoFilm - Inicio">
        <span className="v4-brand-mark">P</span>
        <span className="v4-brand-copy"><b>PikoFilm</b><small>Biblioteca personal</small></span>
      </Link>
      <nav className="v4-side-nav">
        {desktopItems.map(([href,label,icon])=><div key={href} className={href==='/calidad'&&inQuality?'v4-nav-group open':'v4-nav-group'}>
          <Link prefetch={false} href={href} className={active(href)?'active':''} aria-current={active(href)?'page':undefined}><span className="v4-nav-icon">{icon}</span><span>{label}</span></Link>
          {href==='/catalogo'&&<Link prefetch={false} href="/sagas" className={path.startsWith('/sagas')?'v4-catalog-subitem active':'v4-catalog-subitem'} aria-current={path.startsWith('/sagas')?'page':undefined}>Sagas</Link>}
          {href==='/calidad'&&inQuality&&<div className="v4-quality-subnav">{qualityPrimaryItems.map(([h,l])=><Link prefetch={false} key={h} href={h} className={qualityActive(h)?'active':''} aria-current={qualityActive(h)?'page':undefined}>{l}</Link>)}</div>}
        </div>)}
      </nav>
    </aside>

    <header className="v4-header">
      <strong>{current}</strong>
      <div className="v4-header-tools"><GlobalSearch/></div>
    </header>

    <nav className="v4-mobile-nav" aria-label="Navegación principal móvil">
      {mobileItems.map(([href,label,icon])=><Link prefetch={false} key={href} href={href} className={active(href)?'active':''} aria-current={active(href)?'page':undefined}><span>{icon}</span><small>{label}</small></Link>)}
      <button ref={moreButtonRef} type="button" className={moreActive||moreOpen?'active':''} aria-expanded={moreOpen} aria-controls="v4-more-menu" onClick={()=>setMoreOpen(v=>!v)}><span>•••</span><small>Más</small></button>
    </nav>

    {moreOpen&&<div className="v4-more-backdrop" onClick={()=>setMoreOpen(false)}><div id="v4-more-menu" className="v4-more-menu" role="menu" aria-label="Más secciones" onClick={event=>event.stopPropagation()}>
      <strong>Más</strong>
      {secondaryItems.map(([href,label,icon])=><Link prefetch={false} role="menuitem" key={href} href={href} className={active(href)?'active':''}><span>{icon}</span>{label}</Link>)}
    </div></div>}
  </>;
}
