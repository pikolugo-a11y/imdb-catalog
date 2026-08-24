import Link from 'next/link';
import {getLifecycleForIds} from '@/lib/lifecycle';
import './lifecycle-detail.css';
import './series-command-v3.css';

export default async function CatalogDetailLayout({children,params}){
  const {imdbId}=await params;
  const state=(await getLifecycleForIds([imdbId])).get(imdbId);
  if(!state)return children;
  return <><aside className={`detail-lifecycle ${state.tone}`}><div><span>ESTADO DEL CICLO DE VIDA</span><strong>{state.label}</strong></div><p>Catálogo es la ficha maestra. Este estado se recalcula automáticamente con los datos actuales y determina qué sección puede trabajar el título.</p>{state.state!=='COMPLETE'&&state.state!=='EXCLUDED'?<Link href={state.area}>Abrir cola correspondiente →</Link>:null}</aside>{children}</>;
}
