import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getCatalogItem } from '@/lib/queries';
import { Status } from '@/components/Status';
import { markAcquiring, clearAcquiring } from '@/app/actions';

export const dynamic = 'force-dynamic';

export default async function Ficha({ params }) {
  const { imdbId } = await params;
  const item = await getCatalogItem(imdbId);
  if (!item) notFound();
  const cast = item.credits.filter(c => c.credit_type === 'cast').slice(0,12);
  const crew = item.credits.filter(c => c.credit_type !== 'cast').slice(0,8);
  return <><Link className="back" href="/catalogo">← Volver al catálogo</Link><div className="detail-head"><div><div className="eyebrow">{item.type || 'Título'} · {item.year || '—'}</div><h1>{item.display_title}</h1>{item.original_title && item.original_title !== item.display_title && <p className="original">{item.original_title}</p>}<div className="detail-status"><Status value={item.effective_status}/>{item.resolution && <span className="pill">{item.resolution}</span>}{item.runtime && <span className="pill">{item.runtime} min</span>}</div>{item.effective_status !== 'in_plex' && <form className="acquire-form" action={item.effective_status === 'acquiring' ? clearAcquiring : markAcquiring}><input type="hidden" name="imdbId" value={item.imdb_id}/><button type="submit">{item.effective_status === 'acquiring' ? 'Quitar de En proceso' : 'Marcar En proceso'}</button></form>}</div><div className="score"><span>{item.final_rating?.toFixed?.(2) ?? item.final_rating ?? '—'}</span><small>PikoScore</small></div></div>
  {item.tagline && <p className="tagline">{item.tagline}</p>}
  <div className="detail-grid"><section className="card"><h3>Información</h3><p>{item.overview || 'Sin sinopsis enriquecida.'}</p><div className="meta-list"><div><b>País</b><span>{item.country || '—'}</span></div><div><b>Estreno</b><span>{item.release_date ? new Date(item.release_date).toLocaleDateString('es-ES') : item.year || '—'}</span></div><div><b>Géneros</b><span>{(item.genres||[]).join(', ') || '—'}</span></div><div><b>Saga</b><span>{item.collection_name || '—'}</span></div></div></section><section className="card"><h3>Puntuaciones</h3><div className="rating-row"><b>IMDb</b><span>{item.imdb_rating ?? '—'} · {item.imdb_votes?.toLocaleString?.('es-ES') ?? 0} votos</span></div><div className="rating-row"><b>FilmAffinity</b><span>{item.fa_rating ?? '—'} · {item.fa_votes?.toLocaleString?.('es-ES') ?? 0} votos</span></div><div className="rating-row"><b>TMDb</b><span>{item.tmdb_rating ?? '—'} · {item.tmdb_votes?.toLocaleString?.('es-ES') ?? 0} votos</span></div><div className="external-links">{item.imdb_url && <a href={item.imdb_url} target="_blank">IMDb ↗</a>}{item.fa_url && <a href={item.fa_url} target="_blank">FilmAffinity ↗</a>}{item.tmdb_url && <a href={item.tmdb_url} target="_blank">TMDb ↗</a>}</div></section></div>
  <section className="section"><div className="section-head"><h2>Reparto principal</h2></div><div className="credit-grid">{cast.map((c,i)=><div className="credit" key={`${c.name}-${i}`}><b>{c.name}</b><span>{c.character_name || 'Reparto'}</span></div>)}</div></section>
  {crew.length>0 && <section className="section"><div className="section-head"><h2>Equipo</h2></div><div className="credit-grid">{crew.map((c,i)=><div className="credit" key={`${c.name}-${i}`}><b>{c.name}</b><span>{c.job || c.credit_type}</span></div>)}</div></section>}
  </>;
}
