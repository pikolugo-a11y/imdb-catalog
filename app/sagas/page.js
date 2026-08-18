import { getSagas } from '@/lib/queries';

export const dynamic = 'force-dynamic';

export default async function Sagas() {
  const rows = await getSagas();
  return <><div className="hero"><div><div className="eyebrow">Completitud</div><h1>Sagas y colecciones</h1><p>Qué partes de cada colección seleccionada ya están en Plex, cuáles faltan y cuáles están en proceso.</p></div></div><div className="table-wrap"><table><thead><tr><th>Colección</th><th>Seleccionadas</th><th>En Plex</th><th>En proceso</th><th>Faltan</th><th>Completitud</th></tr></thead><tbody>{rows.map(r=>{const pct=r.total_selected?Math.round((r.in_plex/r.total_selected)*100):0;return <tr key={r.collection_name}><td className="title">{r.collection_name}</td><td>{r.total_selected}</td><td>{r.in_plex}</td><td>{r.acquiring}</td><td>{r.missing}</td><td>{pct}%</td></tr>})}</tbody></table></div></>;
}
