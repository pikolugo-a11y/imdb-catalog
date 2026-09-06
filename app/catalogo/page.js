import Link from 'next/link';
import {redirect} from 'next/navigation';
import {Poster} from '@/components/MediaCard';
import CatalogFiltersV4 from '@/components/CatalogFiltersV4';
import {CATALOG_V4_PAGE_SIZE,catalogV4Href,getCatalogV4,getCatalogV4Genres,parseCatalogV4} from '@/lib/catalog-v4-queries';
import './catalog-v4.css';

export const dynamic='force-dynamic';

const fmt=v=>v==null?'—':Number(v).toFixed(1);
const typeLabel=v=>v==='Miniserie'?'Miniserie':v==='Serie'?'Serie':'Película';
function genrePreview(genres=[],max=3){const shown=genres.slice(0,max),more=Math.max(0,genres.length-max);return <div className="cv4-genre-chips" title={genres.join(', ')}>{shown.map(g=><span key={g}>{g}</span>)}{more>0&&<span className="more">+{more}</span>}{!genres.length&&<span className="empty">—</span>}</div>}
function scoreSortHref(s,key){const same=s.sort===key,defaultDir=key==='title'?'asc':'desc',dir=same?(s.dir==='asc'?'desc':'asc'):defaultDir;return catalogV4Href(s,{sort:key,dir,page:1})}
function arrow(s,key){return s.sort===key?<span aria-hidden="true">{s.dir==='asc'?'↑':'↓'}</span>:null}
function titleHref(r,returnTo){return `/catalogo/${r.imdb_id}?from=${encodeURIComponent(returnTo)}`}

export default async function Catalogo({searchParams}){
  const raw=await searchParams,s0=parseCatalogV4(raw);
  if(raw.view==='grid'||raw.type||raw.status==='missing'||(raw.scope&&!['all','movies','series'].includes(raw.scope))||(raw.sort&&!['score','year','title'].includes(raw.sort))||(raw.dir&&!['asc','desc'].includes(raw.dir)))redirect(catalogV4Href(s0));
  const genresPromise=getCatalogV4Genres();
  const result=await getCatalogV4(raw),genres=await genresPromise,s=result.state;
  const total=Number(result.summary.total||0),pages=result.pageCount;
  if(!s.invalidYearRange&&total>0&&Number(raw.page||1)>pages)redirect(catalogV4Href(s,{page:pages}));
  const first=total?((s.page-1)*CATALOG_V4_PAGE_SIZE)+1:0,last=Math.min(s.page*CATALOG_V4_PAGE_SIZE,total),returnTo=catalogV4Href(s);
  const tabHref=scope=>catalogV4Href(s,{scope,page:1});
  const pageHref=page=>catalogV4Href(s,{page});
  const clearHref=catalogV4Href(s,{q:'',plex:'all',genres:[],genreMode:'any',yearFrom:null,yearTo:null,page:1});
  const sagaHref=`/sagas?catalogReturn=${encodeURIComponent(returnTo)}`;
  const hasFilters=Boolean(s.q||s.plex!=='all'||s.genres.length||s.yearFrom!=null||s.yearTo!=null);
  return <div className="catalog-v4">
    <header className="cv4-hero">
      <div><span className="cv4-eyebrow">Base audiovisual</span><h1>Catálogo</h1><p>Tu colección maestra, ordenada para encontrar, comparar y consultar.</p></div>
      <Link className="cv4-excluded-link" href="/catalogo/excluidas"><span aria-hidden="true">⊘</span> Excluidas</Link>
    </header>

    <nav className="cv4-tabs" aria-label="Secciones del catálogo">
      <Link className={s.scope==='all'?'active':''} href={tabHref('all')}>Todo</Link>
      <Link className={s.scope==='movies'?'active':''} href={tabHref('movies')}>Películas</Link>
      <Link className={s.scope==='series'?'active':''} href={tabHref('series')}>Series</Link>
      <Link href={sagaHref}>Sagas <span aria-hidden="true">↗</span></Link>
    </nav>

    <CatalogFiltersV4 genres={genres} invalidYearRange={s.invalidYearRange}/>

    <section className="cv4-summary" aria-label="Resumen de resultados">
      <article><span>Total</span><strong>{total.toLocaleString('es-ES')}</strong></article>
      <article><span>En Plex</span><strong>{Number(result.summary.in_plex||0).toLocaleString('es-ES')}</strong></article>
      <article><span>Sin Plex</span><strong>{Number(result.summary.without_plex||0).toLocaleString('es-ES')}</strong></article>
    </section>

    <div className="cv4-toolbar">
      <div><strong>{first.toLocaleString('es-ES')}–{last.toLocaleString('es-ES')}</strong><span> de {total.toLocaleString('es-ES')}{hasFilters?' filtrados':''}</span></div>
      <div className="cv4-view"><span>Vista</span><Link className={s.view==='list'?'active':''} href={catalogV4Href(s,{view:'list'})} aria-label="Vista lista">☷</Link><Link className={s.view==='posters'?'active':''} href={catalogV4Href(s,{view:'posters'})} aria-label="Vista carátulas">▦</Link></div>
    </div>

    {s.invalidYearRange?<section className="cv4-state invalid"><strong>Revisa el rango de años</strong><p>El año inicial no puede ser posterior al año final. No se ha ejecutado la búsqueda.</p></section>:
    result.rows.length===0?<section className="cv4-state"><strong>No hay títulos que coincidan con estos filtros</strong><p>La consulta es válida, pero no devuelve obras de PikoFilm.</p>{hasFilters&&<Link href={clearHref}>Limpiar filtros</Link>}</section>:
    s.view==='posters'?<div className="cv4-poster-grid">{result.rows.map(r=><Link className="cv4-poster-card" key={r.imdb_id} href={titleHref(r,returnTo)}><div className="cv4-poster-art"><Poster path={r.poster_path} title={r.display_title}/><span className={`cv4-plex-dot ${r.effective_status==='in_plex'?'in':'out'}`} title={r.effective_status==='in_plex'?'En Plex':'Sin Plex'}>{r.effective_status==='in_plex'?'✓':'—'}</span></div><div className="cv4-poster-copy"><strong>{r.display_title}</strong><span>{r.year||'—'} · {typeLabel(r.type)}</span><div><b>{fmt(r.final_rating)}</b><small>PikoScore</small><em>{r.effective_status==='in_plex'?'En Plex':'Sin Plex'}</em></div></div></Link>)}</div>:
    <div className="cv4-table-shell"><table className="cv4-table"><thead><tr><th><Link href={scoreSortHref(s,'title')}>Título {arrow(s,'title')}</Link></th><th><Link href={scoreSortHref(s,'year')}>Año {arrow(s,'year')}</Link></th><th>Tipo</th><th>Géneros</th><th className="num"><Link href={scoreSortHref(s,'score')}>PikoScore {arrow(s,'score')}</Link></th><th className="num">PikoQuality</th><th>Plex</th></tr></thead><tbody>{result.rows.map(r=><tr key={r.imdb_id}><td className="cv4-title"><Link href={titleHref(r,returnTo)}>{r.display_title}</Link></td><td>{r.year||'—'}</td><td>{typeLabel(r.type)}</td><td>{genrePreview(r.genres)}</td><td className="num cv4-score">{fmt(r.final_rating)}</td><td className="num">{fmt(r.pikoquality)}</td><td><span className={`cv4-plex ${r.effective_status==='in_plex'?'in':'out'}`}><i aria-hidden="true"/>{r.effective_status==='in_plex'?'En Plex':'Sin Plex'}</span></td></tr>)}</tbody></table>
      <div className="cv4-mobile-list">{result.rows.map(r=><Link key={r.imdb_id} href={titleHref(r,returnTo)} className="cv4-mobile-row"><strong>{r.display_title}</strong><span>{r.year||'—'} · {typeLabel(r.type)} · {(r.genres||[]).slice(0,2).join(', ')||'Sin género'}{r.genres?.length>2?` +${r.genres.length-2}`:''}</span><div><b>{fmt(r.final_rating)} <small>PikoScore</small></b><b>{fmt(r.pikoquality)} <small>PikoQuality</small></b><em className={r.effective_status==='in_plex'?'in':'out'}>{r.effective_status==='in_plex'?'En Plex':'Sin Plex'}</em></div></Link>)}</div>
    </div>}

    {!s.invalidYearRange&&total>CATALOG_V4_PAGE_SIZE&&<nav className="cv4-pagination" aria-label="Paginación"><Link className={s.page<=1?'disabled':''} href={pageHref(Math.max(1,s.page-1))}>‹ <span>Anterior</span></Link><div>{s.page>2&&<Link href={pageHref(1)}>1</Link>}{s.page>3&&<i>…</i>}{[s.page-1,s.page,s.page+1].filter(x=>x>=1&&x<=pages).map(x=><Link key={x} className={x===s.page?'active':''} href={pageHref(x)}>{x}</Link>)}{s.page<pages-2&&<i>…</i>}{s.page<pages-1&&<Link href={pageHref(pages)}>{pages}</Link>}</div><Link className={s.page>=pages?'disabled':''} href={pageHref(Math.min(pages,s.page+1))}><span>Siguiente</span> ›</Link></nav>}
  </div>;
}
