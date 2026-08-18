import { getMovieQuality } from '@/lib/queries';

export const dynamic = 'force-dynamic';

export default async function CalidadPeliculas() {
  const rows = await getMovieQuality();
  return <><div className="hero"><div><div className="eyebrow">Diagnóstico · películas</div><h1>Calidad de películas</h1><p>Cola priorizada de problemas detectados sobre títulos y ficheros de Plex.</p></div></div><div className="table-wrap"><table><thead><tr><th>Riesgo</th><th>Título Plex</th><th>Año</th><th>Tipo</th><th>Motivos</th><th>Estado</th></tr></thead><tbody>{rows.map(r=><tr key={r.id}><td><b>{r.risk_score}</b></td><td className="title">{r.plex_title || r.rating_key}</td><td>{r.plex_year || '—'}</td><td>{r.task_type}</td><td>{Array.isArray(r.reasons) ? r.reasons.map((x,i)=><span className="pill" key={i}>{typeof x === 'string' ? x : JSON.stringify(x)}</span>) : String(r.reasons||'—')}</td><td>{r.status}</td></tr>)}</tbody></table></div></>;
}
