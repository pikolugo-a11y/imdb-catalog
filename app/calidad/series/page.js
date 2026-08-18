import { getSeriesQuality } from '@/lib/queries';

export const dynamic = 'force-dynamic';

export default async function CalidadSeries() {
  const rows = await getSeriesQuality();
  return <><div className="hero"><div><div className="eyebrow">Diagnóstico · series</div><h1>Calidad de series</h1><p>Control episodio a episodio. El siguiente bloque añadirá la capa de disponibilidad en España para separar «faltante real» de «todavía no disponible».</p></div></div><div className="alert">Los <b>missing</b> actuales proceden del diagnóstico técnico existente. Todavía no los presentamos como error definitivo hasta contrastar disponibilidad española.</div><div className="table-wrap"><table><thead><tr><th>Serie</th><th>Año</th><th>Temporadas oficiales</th><th>Episodios oficiales</th><th>Presentes</th><th>Faltantes técnicos</th><th>Combinados</th></tr></thead><tbody>{rows.map(r=><tr key={r.show_rating_key}><td className="title">{r.title}</td><td>{r.year||'—'}</td><td>{r.official_seasons??'—'}</td><td>{r.official_episodes??'—'}</td><td>{r.present}</td><td><span className="status bad">{r.missing}</span></td><td>{r.combined}</td></tr>)}</tbody></table></div></>;
}
