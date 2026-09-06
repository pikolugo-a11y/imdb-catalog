import Link from 'next/link';
import {redirect} from 'next/navigation';
import {restoreExclusionAction} from './actions';
import {EXCLUDED_V4_PAGE_SIZE,excludedV4Href,getExcludedV4,parseExcludedV4} from '@/lib/excluded-v4-queries';
import './excluded-v4.css';

export const dynamic='force-dynamic';
function date(v){if(!v)return '—';const d=new Date(v);return Number.isNaN(d.getTime())?'—':d.toLocaleDateString('es-ES')}
function typeLabel(v){return ['Película','Serie','Miniserie'].includes(v)?v:'—'}

export default async function Excluidas({searchParams}){
  const raw=await searchParams,p=parseExcludedV4(raw),result=await getExcludedV4(raw),s=result.state;
  if(result.total>0&&p.page>result.pageCount)redirect(excludedV4Href(s,{page:result.pageCount}));
  const first=result.total?((s.page-1)*EXCLUDED_V4_PAGE_SIZE)+1:0,last=Math.min(s.page*EXCLUDED_V4_PAGE_SIZE,result.total),returnTo=excludedV4Href(s),pageHref=x=>excludedV4Href(s,{page:x});
  return <div className="excluded-v4">
    <header className="ev4-hero"><div><span>Catálogo · historial de decisión</span><h1>Excluidas</h1><p>Obras que decidiste mantener fuera de la base audiovisual.</p></div><Link href="/catalogo">← Catálogo</Link></header>
    <nav className="ev4-context" aria-label="Contexto de Catálogo"><Link href="/catalogo">Todo</Link><Link href="/catalogo?scope=movies">Películas</Link><Link href="/catalogo?scope=series">Series</Link><Link href="/sagas">Sagas</Link><strong>Excluidas</strong></nav>

    {raw.notice==='restored'&&<div className="ev4-notice success"><b>Restaurada a Novedades</b><span>{raw.imdb||'La obra'} queda pendiente de tu decisión de admisión. Sigues en Excluidas.</span></div>}
    {raw.notice==='restore_error'&&<div className="ev4-notice error"><b>No se pudo restaurar</b><span>La obra sigue excluida. Puedes reintentarlo desde su fila.</span></div>}

    <section className="ev4-search-panel"><form method="get"><label><span>Buscar en excluidas</span><div><i aria-hidden="true">⌕</i><input name="q" defaultValue={s.q} placeholder="Título, título original o tt…"/><button>Buscar</button></div></label>{s.q&&<Link href="/catalogo/excluidas">Limpiar búsqueda</Link>}</form></section>

    <div className="ev4-resultbar"><div><strong>{first.toLocaleString('es-ES')}–{last.toLocaleString('es-ES')}</strong> de {result.total.toLocaleString('es-ES')}</div><span>Más recientes primero</span></div>

    {result.rows.length===0?<section className="ev4-empty"><strong>{s.q?'No hay títulos excluidos que coincidan con esta búsqueda':'No hay títulos excluidos'}</strong>{s.q?<><p>Prueba con otro título o IMDb ID.</p><Link href="/catalogo/excluidas">Limpiar búsqueda</Link></>:<p>Las decisiones de exclusión aparecerán aquí y seguirán siendo reversibles.</p>}</section>:
    <div className="ev4-table-shell"><table className="ev4-table"><thead><tr><th>Título</th><th>Año</th><th>Tipo</th><th>Fecha de exclusión</th><th/></tr></thead><tbody>{result.rows.map(r=>{const href=`/catalogo/${r.imdb_id}?from=${encodeURIComponent(returnTo)}`;return <tr key={r.imdb_id}><td><Link href={href}>{r.display_title}</Link></td><td>{r.year||'—'}</td><td>{typeLabel(r.type)}</td><td>{date(r.excluded_at)}</td><td><form action={restoreExclusionAction}><input type="hidden" name="imdbId" value={r.imdb_id}/><input type="hidden" name="returnTo" value={returnTo}/><button>↻ Restaurar</button></form></td></tr>})}</tbody></table><div className="ev4-mobile-list">{result.rows.map(r=>{const href=`/catalogo/${r.imdb_id}?from=${encodeURIComponent(returnTo)}`;return <article key={r.imdb_id}><Link href={href}><strong>{r.display_title}</strong><span>{r.year||'—'} · {typeLabel(r.type)} · Excluida {date(r.excluded_at)}</span></Link><form action={restoreExclusionAction}><input type="hidden" name="imdbId" value={r.imdb_id}/><input type="hidden" name="returnTo" value={returnTo}/><button>↻ Restaurar</button></form></article>})}</div></div>}

    {result.total>EXCLUDED_V4_PAGE_SIZE&&<nav className="ev4-pagination" aria-label="Paginación"><Link className={s.page<=1?'disabled':''} href={pageHref(Math.max(1,s.page-1))}>‹ Anterior</Link><span>Página <b>{s.page}</b> de {result.pageCount}</span><Link className={s.page>=result.pageCount?'disabled':''} href={pageHref(Math.min(result.pageCount,s.page+1))}>Siguiente ›</Link></nav>}
  </div>;
}
