import Kpi from '@/components/Kpi';
import { getPlexOutsideCatalog, getPlexSummary } from '@/lib/queries';

export const dynamic = 'force-dynamic';

export default async function Plex() {
  const [s, rows] = await Promise.all([getPlexSummary(), getPlexOutsideCatalog()]);
  return <><div className="hero"><div><div className="eyebrow">Biblioteca real</div><h1>Plex</h1><p>Inventario real separado del catálogo deseado. Aquí aparecen también los elementos que no cruzan con PikoFilm.</p></div></div>
  <div className="grid"><Kpi label="Elementos activos" value={s.active_items}/><Kpi label="Cruces catálogo" value={s.catalog_matches}/><Kpi label="Fuera del catálogo" value={s.outside_catalog}/><Kpi label="Marcados vistos" value={s.watched_items}/></div>
  <section className="section"><div className="section-head"><h2>Fuera del catálogo</h2><p>Últimos elementos Plex sin pertenencia normal al catálogo.</p></div><div className="table-wrap"><table><thead><tr><th>Título Plex</th><th>Año</th><th>IMDb detectado</th><th>Estado cruce</th><th>Fecha alta</th></tr></thead><tbody>{rows.map(r=><tr key={r.rating_key}><td className="title">{r.plex_title || 'Sin título'}</td><td>{r.plex_year || '—'}</td><td>{r.imdb_id || '—'}</td><td>{r.catalog_state || '—'}</td><td>{r.added_at ? new Date(r.added_at).toLocaleDateString('es-ES') : '—'}</td></tr>)}</tbody></table></div></section></>;
}
