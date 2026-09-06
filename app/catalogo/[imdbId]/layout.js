import Link from '@/components/NoPrefetchLink';
import {getLifecycleForIds} from '@/lib/lifecycle';
import {getMovieDetailExtras} from '@/lib/movie-detail-extras';
import './lifecycle-detail.css';
import './series-command-v3.css';

export default async function CatalogDetailLayout({children,params}){
  const {imdbId}=await params;
  const state=(await getLifecycleForIds([imdbId])).get(imdbId);
  if(!state)return children;

  // Lifecycle is materialized and can lag behind the canonical technical state.
  // Never tell the user PikoQuality is pending when the current physical copy
  // already has a valid evaluated PikoQuality (same canonical check as Ficha).
  if(state.state==='TECH_PENDING'){
    const currentQuality=await getMovieDetailExtras(imdbId).catch(()=>null);
    if(currentQuality?.score!=null)return children;
  }

  return <><aside className={`detail-lifecycle ${state.tone}`}><div><span>ESTADO DEL CICLO DE VIDA</span><strong>{state.label}</strong></div><p>Catálogo es la ficha maestra. Este estado se recalcula automáticamente con los datos actuales y determina qué sección puede trabajar el título.</p>{state.state!=='COMPLETE'&&state.state!=='EXCLUDED'?<Link href={state.area}>Abrir cola correspondiente →</Link>:null}</aside>{children}</>;
}
