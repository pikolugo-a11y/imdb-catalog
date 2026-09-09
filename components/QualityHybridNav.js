'use client';

import Link from '@/components/NoPrefetchLink';
import {usePathname} from 'next/navigation';

const common=[
  ['/calidad/identidad','Identidad'],
  ['/calidad/validacion-identidad','Validación'],
  ['/calidad/datos','Datos'],
  ['/calidad/personas','Personas'],
  ['/calidad/pikoquality','PikoQuality'],
  ['/calidad/sin-estado','Integridad'],
];

export default function QualityHybridNav(){
  const path=usePathname();
  const inCommon=common.some(([href])=>path.startsWith(href));
  if(!inCommon)return null;
  return <nav className="qv4-common-nav" aria-label="Centro de Calidad">
    <Link href="/calidad/centro" className="qv4-common-home">Centro</Link>
    <div>{common.map(([href,label])=><Link key={href} href={href} className={path.startsWith(href)?'active':''} aria-current={path.startsWith(href)?'page':undefined}>{label}</Link>)}</div>
  </nav>;
}
