import Link from '@/components/NoPrefetchLink';
import PendingSubmitButton from '@/components/PendingSubmitButton';
import {db} from '@/lib/db';
import {restartMissingLifecycleAction} from './actions';
import '../calidad-v4.css';
import './lifecycle-integrity.css';
export const dynamic='force-dynamic';
const PAGE_SIZE=100;
const href=page=>`/calidad/sin-estado${page>1?`?page=${page}`:''}`;

export default async function SinEstado({searchParams}){
  const p=await searchParams,sql=db(),requested=Math.max(1,Number(p?.page)||1);
  const[count]=await sql`SELECT count(*)::int total FROM movies m LEFT JOIN catalog_lifecycle cl USING(imdb_id) LEFT JOIN catalog_exclusions ex USING(imdb_id) WHERE cl.imdb_id IS NULL AND ex.imdb_id IS NULL`;
  const total=Number(count?.total||0),pages=Math.max(1,Math.ceil(total/PAGE_SIZE)),page=Math.min(requested,pages),offset=(page-1)*PAGE_SIZE;
  const rows=await sql`SELECT m.imdb_id,COALESCE(m.title_es,m.title,m.original_title) title,m.year,m.type,m.tmdb_id,pcs.status plex_status,pcs.rating_key FROM movies m LEFT JOIN catalog_lifecycle cl USING(imdb_id) LEFT JOIN catalog_exclusions ex USING(imdb_id) LEFT JOIN plex_catalog_status pcs USING(imdb_id) WHERE cl.imdb_id IS NULL AND ex.imdb_id IS NULL ORDER BY m.synced_at DESC NULLS LAST,m.imdb_id LIMIT ${PAGE_SIZE} OFFSET ${offset}`;
  return <div className="liv4">
    <div className="breadcrumbs"><Link href="/calidad">Calidad</Link><span>›</span><Link href="/calidad/centro">Centro de Calidad</Link><span>›</span><b>Integridad Lifecycle</b></div>
    <header className="liv4-hero"><div><div className="liv4-eyebrow">Calidad · recuperación excepcional</div><h1>Integridad Lifecycle</h1><p>Títulos del Catálogo que han perdido su estado Lifecycle. Reiniciar recalcula el estado desde los datos actuales sin borrar la obra ni su asociación Plex.</p></div><Link className="liv4-back" href="/calidad/centro">← Centro de Calidad</Link></header>
    <section className="liv4-summary"><strong>{total.toLocaleString('es-ES')} título{total===1?'':'s'} sin estado</strong><span>{total?`Página ${page} de ${pages} · reparación individual y explícita`:'No hay reparación pendiente'}</span></section>
    {rows.length===0?<section className="liv4-empty"><strong>✓ Integridad Lifecycle al día</strong><span>Todos los títulos activos del Catálogo tienen un estado funcional persistido.</span></section>:<><section className="liv4-list">{rows.map(r=><article key={r.imdb_id} className="liv4-row"><div><strong>{r.title||r.imdb_id}{r.year?` (${r.year})`:''}</strong><span className="meta">{r.imdb_id} · {r.type||'—'} · TMDb {r.tmdb_id||'—'} · Plex {r.plex_status||'—'}{r.rating_key?` · ${r.rating_key}`:''}</span></div><form action={restartMissingLifecycleAction}><input type="hidden" name="imdbId" value={r.imdb_id}/><PendingSubmitButton pendingLabel="Recalculando…">Reiniciar Lifecycle</PendingSubmitButton></form></article>)}</section>{pages>1&&<nav className="liv4-pages" aria-label="Paginación de integridad">{page>1?<Link href={href(page-1)}>← Anterior</Link>:<span aria-disabled="true">Inicio</span>}<span>Página {page} de {pages}</span>{page<pages?<Link href={href(page+1)}>Siguiente →</Link>:<span aria-disabled="true">Fin</span>}</nav>}</>}
  </div>;
}
