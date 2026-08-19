import Link from 'next/link';
import {MediaCard} from '@/components/MediaCard';
import CatalogFiltersV3 from '@/components/CatalogFiltersV3';
import CatalogSortV3 from '@/components/CatalogSortV3';
import {getCatalogV3,getCatalogFiltersV3,getCatalogStatsV3,catalogPageSize} from '@/lib/catalog-v3-queries';
import {markAcquiring,excludeTitle,restoreTitle} from '@/app/actions';
import './catalog-v3.css';

export const dynamic='force-dynamic';

function qs(p,patch={}){const x=new URLSearchParams();const source={...p,...patch};for(const[k,v]of Object.entries(source)){const value=Array.isArray(v)?v.join(','):v;if(value!==undefined&&value!==null&&value!=='')x.set(k,String(value));}return x.toString();}
function pct(n,total){return total?`${Math.round((Number(n||0)/Number(total))*100)}%`:'0%'}
function StateIcon({kind}){const icons={total:'▦',missing:'!',acquiring:'⋯',plex:'✓'};return <span className={`catalog-stat-icon ${kind}`} aria-hidden="true">{icons[kind]}</span>}
function StateDot({state}){return <span className={`catalog-state-dot ${state}`} aria-hidden="true"/>}
function list(v){const raw=Array.isArray(v)?v.join(','):String(v||'');return [...new Set(raw.split(',').map(x=>x.trim()).filter(Boolean))]}
function n(v){const x=Number.parseInt(Array.isArray(v)?v[0]:v,10);return Number.isFinite(x)?x:null}
function fmt1(v){const x=Number(v);return Number.isFinite(x)?x.toFixed(1):'—'}
function runtime(v){const x=Number(v);if(!Number.isFinite(x)||x<=0)return '—';const h=Math.floor(x/60),m=x%60;return h?`${h}h ${m?`${m}m`:''}`:`${m}m`}
function genresText(v){const a=Array.isArray(v)?v:[];return a.length>2?`${a.slice(0,2).join(', ')} +${a.length-2}`:a.join(', ')||'—'}
function firstCountry(v){const s=String(v||'').trim();if(!s)return '—';return s.split(/\s*[·,;|]\s*/).filter(Boolean)[0]||s}
function statusLabel(v){return v==='in_plex'?'En Plex':v==='acquiring'?'En proceso':'Falta'}

export default async function Catalogo({searchParams}){
  const p=await searchParams;const view=p.view==='list'?'list':'grid';
  const [rows,f,stats]=await Promise.all([getCatalogV3({...p,view}),getCatalogFiltersV3(),getCatalogStatsV3(p)]);
  const page=Math.max(1,n(p.page)||1),pageSize=catalogPageSize(view),total=Number(stats.total||0),pages=Math.max(1,Math.ceil(total/pageSize)),safePage=Math.min(page,pages),first=total?((safePage-1)*pageSize)+1:0,last=Math.min(safePage*pageSize,total);
  const returnTo='/catalogo?'+qs(p,{notice:'',undo:''});const genres=list(p.genres||p.genre),legacyYear=n(p.year);
  const initial={q:String(p.q||''),type:String(p.type||''),status:String(p.status||''),genres,genreMode:p.genreMode==='all'?'all':'any',yearFrom:n(p.yearFrom)??legacyYear??'',yearTo:n(p.yearTo)??legacyYear??''};
  const hasFilters=Boolean(initial.q||initial.type||initial.status||genres.length||initial.yearFrom||initial.yearTo),sort=String(p.sort||'score'),dir=String(p.dir||(sort==='title'?'asc':'desc'));
  const statItems=[['total','Total',stats.total,'100%'],['missing','Faltan',stats.missing,pct(stats.missing,total)],['acquiring','Proceso',stats.acquiring,pct(stats.acquiring,total)],['plex','Plex',stats.in_plex,pct(stats.in_plex,total)]];
  const pageHref=x=>'/catalogo?'+qs(p,{page:x});
  const sortHref=key=>{const current=sort===key,nextDir=current?(dir==='asc'?'desc':'asc'):(key==='title'?'asc':'desc');return '/catalogo?'+qs(p,{sort:key,dir:nextDir,page:1,view:'list'});};
  const arrow=key=>sort===key?(dir==='asc'?' ↑':' ↓'):'';

  return <div className="catalog-v3 catalog-v3-rebuild catalog-r4">
    {p.notice==='excluded'&&p.undo&&<div className="toast success catalog-toast"><span>Título excluido correctamente.</span><form action={restoreTitle}><input type="hidden" name="imdbId" value={p.undo}/><input type="hidden" name="returnTo" value={returnTo}/><button>Deshacer</button></form></div>}

    <div className="catalog-filter-shell catalog-filter-shell-r4"><CatalogFiltersV3 genres={f.genres} minYear={f.minYear} maxYear={f.maxYear} initial={initial}/></div>

    <section className="catalog-stat-strip catalog-stat-strip-r4" aria-label="Resumen del catálogo">{statItems.map(([kind,label,value,percent])=><article key={kind} className={`catalog-stat ${kind}`}><StateIcon kind={kind}/><div><strong>{Number(value||0).toLocaleString('es-ES')}</strong><span>{label}</span></div><small>{percent}</small></article>)}</section>

    <div className="catalog-resultbar catalog-resultbar-r4">
      <span>Mostrando <b>{first.toLocaleString('es-ES')}–{last.toLocaleString('es-ES')}</b> de <b>{total.toLocaleString('es-ES')}</b>{hasFilters?' filtrados':''}</span>
      <div className="catalog-result-tools"><Link className="catalog-excluded catalog-excluded-inline" href="/catalogo/excluidas">◉ Excluidas</Link>{view==='grid'&&<CatalogSortV3 sort={sort} dir={dir}/>}<div className="catalog-view-switch catalog-view-inline" aria-label="Vista"><span>Vista</span><div><Link className={view==='grid'?'active':''} href={'/catalogo?'+qs(p,{view:'grid',page:1})} title="Carátulas">▦</Link><Link className={view==='list'?'active':''} href={'/catalogo?'+qs(p,{view:'list',page:1})} title="Tabla">☷</Link></div></div></div>
    </div>

    {rows.length===0?<div className="catalog-empty"><b>No hay títulos con estos criterios</b><span>Prueba a limpiar o cambiar los filtros.</span></div>:view==='grid'?
      <div className="media-grid catalog-poster-grid catalog-poster-grid-r4">{rows.map(r=><article className="media-action catalog-poster-item" key={r.imdb_id}><div className="catalog-poster-wrap"><MediaCard item={r} href={`/catalogo/${r.imdb_id}?from=${encodeURIComponent(returnTo)}`}/><span className={`catalog-poster-status ${r.effective_status||'missing'}`} title={statusLabel(r.effective_status)}>{r.effective_status==='in_plex'?'✓':r.effective_status==='acquiring'?'⋯':'!'}</span>{r.effective_status!=='in_plex'&&<div className="quick-actions catalog-card-actions"><form action={markAcquiring}><input type="hidden" name="imdbId" value={r.imdb_id}/><button>+ En proceso</button></form><form action={excludeTitle}><input type="hidden" name="imdbId" value={r.imdb_id}/><input type="hidden" name="returnTo" value={returnTo}/><button className="danger-soft">Excluir</button></form></div>}</div></article>)}</div>:
      <div className="catalog-table-wrap"><table className="catalog-data-table"><thead><tr><th><Link href={sortHref('title')}>Título{arrow('title')}</Link></th><th><Link href={sortHref('year')}>Año{arrow('year')}</Link></th><th><Link href={sortHref('type')}>Tipo{arrow('type')}</Link></th><th>Géneros</th><th>País</th><th className="num"><Link href={sortHref('score')}>PikoScore{arrow('score')}</Link></th><th className="num"><Link href={sortHref('imdb')}>IMDb{arrow('imdb')}</Link></th><th className="num"><Link href={sortHref('votes')}>Votos{arrow('votes')}</Link></th><th className="num"><Link href={sortHref('runtime')}>Duración{arrow('runtime')}</Link></th><th><Link href={sortHref('status')}>Estado{arrow('status')}</Link></th><th>Acciones</th></tr></thead><tbody>{rows.map(r=>{const href=`/catalogo/${r.imdb_id}?from=${encodeURIComponent(returnTo)}`;return <tr key={r.imdb_id}><td className="catalog-table-title"><Link href={href}>{r.display_title}</Link><small>{r.original_title&&r.original_title!==r.display_title?r.original_title:''}</small></td><td>{r.year||'—'}</td><td>{r.type||'—'}</td><td title={(r.genres||[]).join(', ')}>{genresText(r.genres)}</td><td title={r.country||''}>{firstCountry(r.country)}</td><td className="num score-cell">{fmt1(r.final_rating)}</td><td className="num">{fmt1(r.imdb_rating)}</td><td className="num">{Number(r.imdb_votes||0).toLocaleString('es-ES')}</td><td className="num">{runtime(r.runtime)}</td><td><span className="catalog-list-state"><StateDot state={r.effective_status==='in_plex'?'plex':r.effective_status==='acquiring'?'acquiring':'missing'}/>{statusLabel(r.effective_status)}</span></td><td className="catalog-table-actions"><Link className="catalog-table-action-link" href={href}>Ver</Link>{r.effective_status!=='in_plex'&&<><form action={markAcquiring}><input type="hidden" name="imdbId" value={r.imdb_id}/><button>Proceso</button></form><form action={excludeTitle}><input type="hidden" name="imdbId" value={r.imdb_id}/><input type="hidden" name="returnTo" value={returnTo}/><button>Excluir</button></form></>}</td></tr>})}</tbody></table></div>}

    {total>pageSize&&<nav className="catalog-pagination" aria-label="Paginación"><Link className={safePage<=1?'disabled':''} href={pageHref(Math.max(1,safePage-1))}>‹</Link>{safePage>2&&<Link href={pageHref(1)}>1</Link>}{safePage>3&&<span>…</span>}{[safePage-1,safePage,safePage+1].filter(x=>x>=1&&x<=pages).map(x=><Link key={x} className={x===safePage?'active':''} href={pageHref(x)}>{x}</Link>)}{safePage<pages-2&&<span>…</span>}{safePage<pages-1&&<Link href={pageHref(pages)}>{pages}</Link>}<Link className={safePage>=pages?'disabled':''} href={pageHref(Math.min(pages,safePage+1))}>›</Link></nav>}
  </div>;
}
