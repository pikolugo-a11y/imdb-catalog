'use client';
import Link from 'next/link';
import {usePathname} from 'next/navigation';
const items=[['/','Inicio'],['/catalogo','Catálogo'],['/plex','Biblioteca'],['/calidad','Calidad'],['/sagas','Sagas'],['/admin','Admin']];
export default function Nav(){const path=usePathname();const active=h=>h==='/'?path==='/':path.startsWith(h);return <><header className="topbar ux-topbar"><Link href="/" className="brand"><span>P</span>PikoFilm</Link><nav className="ux-nav">{items.map(([h,l])=><Link key={h} href={h} className={active(h)?'active':''}>{l}</Link>)}</nav><div className="version">V2</div></header><nav className="mobile-nav ux-mobile">{items.slice(0,5).map(([h,l])=><Link key={h} href={h} className={active(h)?'active':''}>{l}</Link>)}</nav></>}
