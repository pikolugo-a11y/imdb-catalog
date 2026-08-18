import Link from 'next/link';
import { getCatalog, getCatalogFilters } from '@/lib/queries';
import { Status } from '@/components/Status';

export const dynamic = 'force-dynamic';

export default async function Catalogo({ searchParams }) {
  const params = await searchParams;
  const [rows, filters] = await Promise.all([getCatalog(params), getCatalogFilters()]);
  return <><div className="hero"><div><div className="eyebrow">Selección</div><h1>Catálogo</h1><p>Busca qué merece incorporarse a Plex y comprueba al instante si ya lo tienes.</p></div></div>
  <form className="filters" method="get">
    <input name="q" defaultValue={params.q || ''} placeholder="Buscar título…" />
    <select name="type" defaultValue={params.type || ''}><option value="">Películas y series</option><option value="movie">Películas</option><option value="series">Series</option><option value="tvSeries">Series TV</option><option value="tvMiniSeries">Miniseries</option></select>
    <select name="status" defaultValue={params.status || ''}><option value="">Cualquier estado</option><option value="missing">Falta</option><option value="acquiring">En proceso</option><option value="in_plex">En Plex</option></select>
    <select name="genre" defaultValue={params.genre || ''}><option value="">Todos los géneros</option>{filters.genres.map(g=><option key={g} value={g}>{g}</option>)}</select>
    <select name="year" defaultValue={params.year || ''}><option value="">Todos los años</option>{filters.years.map(y=><option key={y} value={y}>{y}</option>)}</select>
    <button type="submit">Filtrar</button><Link href="/catalogo" className="filter-reset">Limpiar</Link>
  </form>
  <div className="section-head"><h2>{rows.length} resultados mostrados</h2><p>Máximo 150 por consulta en V1.</p></div>
  <div className="table-wrap"><table><thead><tr><th>Título</th><th>Año</th><th>Valoración</th><th>IMDb</th><th>FA</th><th>Géneros</th><th>Estado</th><th>Resolución</th></tr></thead><tbody>{rows.map(r=><tr key={r.imdb_id}><td><Link href={`/catalogo/${r.imdb_id}`} className="title">{r.display_title}</Link><span className="sub">{r.original_title || r.imdb_id}</span></td><td>{r.year}</td><td>{r.final_rating?.toFixed?.(2) ?? r.final_rating ?? '—'}</td><td>{r.imdb_rating ?? '—'}<span className="sub">{r.imdb_votes?.toLocaleString?.('es-ES') ?? ''} votos</span></td><td>{r.fa_rating ?? '—'}</td><td>{(r.genres||[]).slice(0,3).map(g=><span className="pill" key={g}>{g}</span>)}</td><td><Status value={r.effective_status}/></td><td>{r.resolution || '—'}</td></tr>)}</tbody></table></div></>;
}
