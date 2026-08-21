'use client';
import {usePathname} from 'next/navigation';

export default function NovedadesPlexShell({intake,children}){
  const path=usePathname();
  return <>{path==='/novedades'?intake:null}{children}</>;
}
