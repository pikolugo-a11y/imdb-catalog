import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getSeriesDetail } from '@/lib/queries';

export const dynamic = 'force-dynamic';

function EpisodeState({ status }) {
  if (status === 'present') return <span className="status ok">Presente</span>;
  if (status === 'missing_actionable') return <span className="status bad">Falta en España</span>;
  if (status === 'not_yet_available') return <span className="status warn">Aún no disponible</span>;
  if (status === 'exception') return <span className="status warn">Excepción</span>;
  if (status === 'availability_unknown') return <span className="status warn">Disponibilidad desconocida</span>;
  return <span className="status warn">Revisar</span>;
}

export default async function SerieDetalle({ params }) {
  const { ratingKey } = await params;
  const series = await getSeriesDetail(ratingKey);
  if (!series) notFound();
  const actionable = series.episodes.filter(e => e.effective_status === 'missing_actionable').length;
  const unknown = series.episodes.filter(e => e.effective_status === 'availability_unknown').length;
  const notYet = series.episodes.filter(e => e.effective_status === 'not_yet_available').length;
  const present = series.episodes.filter(e => e.effective_status === 'present').length;
  const seasons = [...new Set(series.episodes.map(e => e.season_number))];
  return <><Link className="back" href="/calidad/series">← Volver a series</Link><div className="detail-head"><div><div className="eyebrow">Diagnóstico por episodio</div><h1>{series.title}</h1><p className="original">{series.year || '—'} · {series.official_seasons ?? '—'} temporadas · {series.official_episodes ?? '—'} episodios oficiales</p></div><div className="score"><span>{actionable}</span><small>faltantes accionables</small></div></div>
  <div className="grid"><div className="kpi"><div className="kpi-label">Presentes</div><div className="kpi-value">{present}</div></div><div className="kpi"><div className="kpi-label">Faltan en España</div><div className="kpi-value">{actionable}</div></div><div className="kpi"><div className="kpi-label">Disponibilidad desconocida</div><div className="kpi-value">{unknown}</div></div><div className="kpi"><div className="kpi-label">Aún no disponibles</div><div className="kpi-value">{notYet}</div></div></div>
  <div className="alert section">PikoFilm solo considera un episodio como <b>faltante real</b> cuando el diagnóstico de Plex dice que falta y existe evidencia de que ya está disponible en España. La ausencia técnica por sí sola no genera una incidencia definitiva.</div>
  {seasons.map(season => <section className="section" key={season}><div className="section-head"><h2>Temporada {season}</h2><p>{series.episodes.filter(e=>e.season_number===season).length} episodios diagnosticados</p></div><div className="table-wrap"><table><thead><tr><th>Ep.</th><th>Nombre esperado</th><th>Emisión origen</th><th>Estado efectivo</th><th>Estado Plex</th><th>Disponibilidad ES</th><th>Duración esperada/real</th><th>Confianza</th></tr></thead><tbody>{series.episodes.filter(e=>e.season_number===season).map(e=><tr key={`${season}-${e.episode_number}`}><td>{e.episode_number}</td><td className="title">{e.expected_name || '—'}</td><td>{e.air_date ? new Date(e.air_date).toLocaleDateString('es-ES') : '—'}</td><td><EpisodeState status={e.effective_status}/></td><td>{e.plex_diagnostic_status || '—'}</td><td>{e.availability_status || 'unknown'}{e.availability_source ? ` · ${e.availability_source}` : ''}</td><td>{e.expected_runtime_minutes ?? '—'} / {e.actual_duration_minutes ?? '—'} min</td><td>{e.availability_confidence || e.plex_confidence || '—'}</td></tr>)}</tbody></table></div></section>)}
  </>;
}
