import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getSeriesDetail } from '@/lib/queries';

export const dynamic = 'force-dynamic';

function EpisodeState({ status }) {
  if (status === 'present') return <span className="status ok">Presente</span>;
  if (status === 'covered_combined') return <span className="status warn">Combinado</span>;
  return <span className="status bad">Faltante técnico</span>;
}

export default async function SerieDetalle({ params }) {
  const { ratingKey } = await params;
  const series = await getSeriesDetail(ratingKey);
  if (!series) notFound();
  const missing = series.episodes.filter(e => e.status === 'missing').length;
  const present = series.episodes.filter(e => e.status === 'present').length;
  const seasons = [...new Set(series.episodes.map(e => e.season_number))];
  return <><Link className="back" href="/calidad/series">← Volver a series</Link><div className="detail-head"><div><div className="eyebrow">Diagnóstico por episodio</div><h1>{series.title}</h1><p className="original">{series.year || '—'} · {series.official_seasons ?? '—'} temporadas · {series.official_episodes ?? '—'} episodios oficiales</p></div><div className="score"><span>{missing}</span><small>faltantes técnicos</small></div></div>
  <div className="grid"><div className="kpi"><div className="kpi-label">Presentes</div><div className="kpi-value">{present}</div></div><div className="kpi"><div className="kpi-label">Faltantes técnicos</div><div className="kpi-value">{missing}</div></div><div className="kpi"><div className="kpi-label">Temporadas diagnosticadas</div><div className="kpi-value">{seasons.length}</div></div><div className="kpi"><div className="kpi-label">Referencia</div><div className="kpi-value kpi-text">{series.reference_source || '—'}</div></div></div>
  <div className="alert section">Un episodio marcado aquí como faltante todavía puede ser <b>correcto</b> si aún no está disponible en España. Esa distinción se incorporará al motor antes de considerar cerrada la V1.</div>
  {seasons.map(season => <section className="section" key={season}><div className="section-head"><h2>Temporada {season}</h2><p>{series.episodes.filter(e=>e.season_number===season).length} episodios diagnosticados</p></div><div className="table-wrap"><table><thead><tr><th>Ep.</th><th>Nombre esperado</th><th>Emisión origen</th><th>Estado técnico</th><th>Duración esperada/real</th><th>Confianza</th><th>Motivo</th></tr></thead><tbody>{series.episodes.filter(e=>e.season_number===season).map(e=><tr key={`${season}-${e.episode_number}`}><td>{e.episode_number}</td><td className="title">{e.expected_name || '—'}</td><td>{e.air_date ? new Date(e.air_date).toLocaleDateString('es-ES') : '—'}</td><td><EpisodeState status={e.status}/></td><td>{e.expected_runtime_minutes ?? '—'} / {e.actual_duration_minutes ?? '—'} min</td><td>{e.confidence || '—'}</td><td>{e.reason || '—'}</td></tr>)}</tbody></table></div></section>)}
  </>;
}
