import Link from 'next/link';
import { getSeriesQuality } from '@/lib/queries';

export const dynamic = 'force-dynamic';

export default async function CalidadSeries() {
  const rows = await getSeriesQuality();
  return <><div className="hero"><div><div className="eyebrow">Diagnóstico · series</div><h1>Calidad de series</h1><p>Control episodio a episodio, distinguiendo el fallo técnico de lo que realmente requiere acción en España.</p></div></div><div className="alert">Solo un episodio con disponibilidad española confirmada pasa a <b>faltante accionable</b>. Si la disponibilidad no está confirmada, PikoFilm lo mantiene como <b>desconocida</b> y no lo cuenta como error real.</div><div className="table-wrap"><table><thead><tr><th>Serie</th><th>Año</th><th>Temporadas</th><th>Episodios</th><th>Presentes</th><th>Faltan en ES</th><th>Aún no disponibles</th><th>Disponibilidad desconocida</th></tr></thead><tbody>{rows.map(r=><tr key={r.show_rating_key}><td><Link className="title" href={`/calidad/series/${r.show_rating_key}`}>{r.title}</Link></td><td>{r.year||'—'}</td><td>{r.official_seasons??'—'}</td><td>{r.official_episodes??'—'}</td><td>{r.present}</td><td><span className={r.actionable_missing ? 'status bad' : 'status ok'}>{r.actionable_missing}</span></td><td><span className="status warn">{r.not_yet_available}</span></td><td>{r.availability_unknown}</td></tr>)}</tbody></table></div></>;
}
