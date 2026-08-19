'use client';
import Link from 'next/link';
import {usePathname} from 'next/navigation';

const items=[
  ['/', 'Inicio', '⌂'],
  ['/catalogo','Catálogo','▦'],
  ['/novedades','Novedades','✦'],
  ['/plex','Biblioteca','▶'],
  ['/calidad','Calidad','✓'],
  ['/sagas','Sagas','◈'],
  ['/admin','Admin','⚙']
];

function sectionLabel(path){
  const item=items.find(([href])=>href==='/'?path==='/':path.startsWith(href));
  return item?.[1]||'PikoFilm';
}

export default function Nav(){
  const path=usePathname();
  const active=href=>href==='/'?path==='/':path.startsWith(href);
  const current=sectionLabel(path);
  return <>
    <aside className="v3-sidebar" aria-label="Navegación principal">
      <Link href="/" className="v3-brand" aria-label="PikoFilm - Inicio">
        <span className="v3-brand-mark">P</span>
        <span className="v3-brand-copy"><b>PikoFilm</b><small>Biblioteca personal</small></span>
      </Link>
      <nav className="v3-side-nav">
        {items.map(([href,label,icon])=><Link key={href} href={href} className={active(href)?'active':''} aria-current={active(href)?'page':undefined}><span className="v3-nav-icon" aria-hidden="true">{icon}</span><span>{label}</span></Link>)}
      </nav>
      <div className="v3-sidebar-foot"><span className="v3-version-pill">V3</span><small>Roadmap en evolución</small></div>
    </aside>

    <header className="v3-header">
      <div><span className="v3-header-kicker">PikoFilm</span><strong>{current}</strong></div>
      <span className="v3-header-status">V3</span>
    </header>

    <nav className="v3-mobile-nav" aria-label="Navegación móvil">
      {items.map(([href,label,icon])=><Link key={href} href={href} className={active(href)?'active':''} aria-current={active(href)?'page':undefined}><span aria-hidden="true">{icon}</span><small>{label}</small></Link>)}
    </nav>
  </>;
}
