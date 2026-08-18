import { getCatalog } from '@/lib/queries';
import { Status } from '@/components/Status';

export const dynamic = 'force-dynamic';

export default async function Catalogo() {
  const rows = await getCatalog();
  return <><div className="hero"><div><div className="eyebrow">Selección</div><h1>Catálogo</h1><p>Universo curado de títulos seleccionables para incorporar a Plex. Primera vista ordenada por valoración global.</p></div></div>
  <div className="alert">V1 técnica: el siguiente bloque añadirá búsqueda, filtros y ficha detallada. Ya se leen datos reales de <b>catalog_read_model</b>.</div>
  <div className="table-wrap"><table><thead><tr><th>Título</th><th>Año</th><th>Valoración</th><th>IMDb</th><th>FA</th><th>Géneros</th><th>Estado</th><th>Resolución</th></tr></thead><tbody>{rows.map(r=><tr key={r.imdb_id}><td><span className="title">{r.display_title}</span><span className="sub">{r.original_title || r.imdb_id}</span></td><td>{r.year}</td><td>{r.final_rating?.toFixed?.(2) ?? r.final_rating ?? '—'}</td><td>{r.imdb_rating ?? '—'}<span className="sub">{r.imdb_votes?.toLocaleString?.('es-ES') ?? ''} votos</span></td><td>{r.fa_rating ?? '—'}</td><td>{(r.genres||[]).slice(0,3).map(g=><span className="pill" key={g}>{g}</span>)}</td><td><Status value={r.effective_status}/></td><td>{r.resolution || '—'}</td></tr>)}</tbody></table></div></>;
}
