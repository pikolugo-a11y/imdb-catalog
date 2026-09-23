import Link from '@/components/NoPrefetchLink';
import RelevanceQueueTable from './RelevanceQueueTable';
import {getPikoRelevanceQualityPage} from '@/lib/pikorelevancia-quality';
import './relevance-quality.css';

export const dynamic='force-dynamic';
const nf=n=>Number(n||0).toLocaleString('es-ES');
const qs=(state,patch={})=>{const p=new URLSearchParams();const s={...state,...patch};if(s.q)p.set('q',s.q);if(Number(s.page)>1)p.set('page',String(s.page));const x=p.toString();return `/calidad/relevancia${x?`?${x}`:''}`;};

export default async function PikoRelevanciaQuality({searchParams}){
  const raw=await searchParams,data=await getPikoRelevanceQualityPage({page:raw.page,q:raw.q});
  const queued=Number(data.active?.items_pending||0),done=Number(data.currentCount||0);
  return <main className="relq-page">
    <div className="breadcrumbs"><Link href="/calidad">Calidad</Link><span>›</span><b>PikoRelevancia</b></div>
    <header className="relq-hero"><div><span>CALIDAD · SERIES</span><h1>PikoRelevancia</h1><p>Completa la relevancia de las series de PikoFilm sin convertirla en una fase del Lifecycle. La deuda histórica la decides tú; después, PikoFilm mantiene automáticamente sólo lo que ya haya sido calculado.</p></div><b>Fórmula {data.version}</b></header>
    <section className="relq-kpis"><article><span>Pendientes iniciales</span><strong>{nf(data.total)}</strong><small>ordenadas por PikoScore</small></article><article><span>Con PikoRelevancia vigente</span><strong>{nf(done)}</strong><small>listas para ordenar Catálogo</small></article><article><span>En cola ahora</span><strong>{nf(queued)}</strong><small>concurrencia 1 · Media Cloud protegida</small></article></section>
    <section className="relq-note"><b>La cola inicial es manual</b><span>Selecciona una o varias. Aunque marques varias, se procesan estrictamente de una en una. Los recálculos futuros sí se programan automáticamente según la edad y el estado de cada serie.</span></section>
    <form className="relq-search"><input name="q" defaultValue={data.q} placeholder="Buscar título o IMDb…"/><button>Buscar</button>{data.q&&<Link href="/calidad/relevancia">Limpiar</Link>}</form>
    <div className="relq-result-head"><b>{nf(data.total)} pendientes</b><span>Página {data.page} de {data.pages}</span></div>
    <RelevanceQueueTable rows={data.rows}/>
    {data.pages>1&&<nav className="relq-pager">{data.page>1?<Link href={qs({q:data.q,page:data.page},{page:data.page-1})}>← Anterior</Link>:<span/>}<b>{data.page} / {data.pages}</b>{data.page<data.pages?<Link href={qs({q:data.q,page:data.page},{page:data.page+1})}>Siguiente →</Link>:<span/>}</nav>}
  </main>;
}
