import Link from 'next/link';
import {Poster} from '@/components/MediaCard';
import {restoreTitle} from '@/app/actions';
import {getExcludedV3,getExcludedStatsV3,excludedPageSize} from '@/lib/excluded-v3-queries';
import './excluded-v3.css';

export const dynamic='force-dynamic';

function qs(p,patch={}){const x=new URLSearchParams();for(const[k,v]of Object.entries({...p,...patch})){if(v!==undefined&&v!==null&&v!=='')x.set(k,String(v));}return x.toString();}
function n(v){const x=Number.parseInt(Array.isArray(v)?v[0]:v,10);return Number.isFinite(x)?x:null}
function date(v){if(!v)return '—';const d=new Date(v);return Number.isNaN(d.getTime())?'—':d.toLocaleDateString('es-ES');}
function typeLabel(v){return v==='Película'?'Película':v==='Miniserie'?'Miniserie':'Serie'}

export default async function Excluidas({searchParams}){
  const p=await searchParams;
  const view=p.view==='list'?'list':'grid';
  const [rows,stats]=await Promise.all([getExcludedV3({...p,view}),getExcludedStatsV3(p)]);
  const page=Math.max(1,n(p.page)||1),pageSize=excludedPageSize(view),total=Number(stats.total||0),pages=Math.max(1,Math.ceil(total/pageSize)),safePage=Math.min(page,pages);
  const first=total?((safePage-1)*pageSize)+1:0,last=Math.min(safePage*pageSize,total);
  const hasFilters=Boolean(p.q||p.type||p.reason||p.from||p.to);
  const pageHref=x=>'/catalogo/excluidas?'+qs(p,{page:x});
  const restoreReturn='/catalogo/excluidas?'+qs(p,{page:safePage});

  return <div className="excluded-v3">
    <div className="excluded-topbar"><div><span className="eyebrow">Catálogo · archivo reversible</span><h1>Excluidas</h1></div><Link className="excluded-back" href="/catalogo">← Volver al catálogo</Link></div>

    <section className="excluded-filter-shell" aria-label="Filtros de excluidas"><form method="get" className="excluded-filter-form"><input type="hidden" name="view" value={view}/><input type="hidden" name="type" value={p.type||''}/><input type="hidden" name="sort" value={p.sort||'newest'}/><div className="excluded-search"><span>⌕</span><input name="q" defaultValue={p.q||''} placeholder="Buscar por título o IMDb ID…"/>{hasFilters&&<Link href="/catalogo/excluidas">Limpiar</Link>}</div><div className="excluded-filter-row"><div className="excluded-type" aria-label="Tipo"><span>Tipo</span><Link className={!p.type?'active':''} href={'/catalogo/excluidas?'+qs(p,{type:'',page:1})}>Todos</Link><Link className={p.type==='movie'?'active':''} href={'/catalogo/excluidas?'+qs(p,{type:'movie',page:1})}>Películas</Link><Link className={p.type==='series'?'active':''} href={'/catalogo/excluidas?'+qs(p,{type:'series',page:1})}>Series</Link></div><label><span>Motivo contiene</span><input name="reason" defaultValue={p.reason||''} placeholder="Ej. manualmente"/></label><label><span>Desde</span><input type="date" name="from" defaultValue={p.from||''}/></label><label><span>Hasta</span><input type="date" name="to" defaultValue={p.to||''}/></label><button>Aplicar</button></div></form></section>

    <section className="excluded-stats" aria-label="Resumen"><article><strong>{total.toLocaleString('es-ES')}</strong><span>Total excluidas</span></article><article><strong>{Number(stats.movies||0).toLocaleString('es-ES')}</strong><span>Películas</span></article><article><strong>{Number(stats.series||0).toLocaleString('es-ES')}</strong><span>Series / miniseries</span></article><article><strong>{Number(stats.last30||0).toLocaleString('es-ES')}</strong><span>Últimos 30 días</span></article></section>

    <div className="excluded-resultbar"><span>Mostrando <b>{first.toLocaleString('es-ES')}–{last.toLocaleString('es-ES')}</b> de <b>{total.toLocaleString('es-ES')}</b>{hasFilters?' filtradas':''}</span><div className="excluded-result-tools"><form method="get" className="excluded-sort-form">{Object.entries(p).filter(([k])=>!['sort','page'].includes(k)).map(([k,v])=><input key={k} type="hidden" name={k} value={Array.isArray(v)?v[0]:v}/>) }<label>Ordenar<select name="sort" defaultValue={p.sort||'newest'}><option value="newest">Más recientes</option><option value="oldest">Más antiguas</option><option value="title">Título A–Z</option><option value="year_desc">Año ↓</option><option value="year_asc">Año ↑</option></select></label><button>Aplicar</button></form><div className="excluded-view-switch"><Link className={view==='grid'?'active':''} href={'/catalogo/excluidas?'+qs(p,{view:'grid',page:1})} title="Carátulas">▦</Link><Link className={view==='list'?'active':''} href={'/catalogo/excluidas?'+qs(p,{view:'list',page:1})} title="Tabla">☷</Link></div></div></div>

    {rows.length===0?<div className="excluded-empty"><b>No hay títulos excluidos con estos criterios</b><span>{hasFilters?'Prueba a limpiar o cambiar los filtros.':'Cuando excluyas un título aparecerá aquí para poder recuperarlo.'}</span></div>:view==='grid'?<div className="excluded-grid">{rows.map(r=><article className="excluded-card" key={r.imdb_id}><div className="excluded-poster"><Poster path={r.poster_path} title={r.display_title}/><span className="excluded-x">×</span></div><div className="excluded-card-body"><b title={r.display_title}>{r.display_title}</b><span>{r.year||'—'} · {typeLabel(r.type)}</span>{r.final_rating!=null&&<small>★ {Number(r.final_rating).toFixed(1)}</small>}<div className="excluded-reason" title={r.reason||'Sin motivo'}>{r.reason||'Sin motivo indicado'}</div><time>{date(r.excluded_at)}</time></div><form action={restoreTitle}><input type="hidden" name="imdbId" value={r.imdb_id}/><input type="hidden" name="returnTo" value={restoreReturn}/><button>↻ Restaurar al catálogo</button></form></article>)}</div>:<div className="excluded-table-wrap"><table className="excluded-table"><thead><tr><th>Título</th><th>Año</th><th>Tipo</th><th>PikoScore</th><th>IMDb</th><th>Motivo</th><th>Fecha exclusión</th><th>Acción</th></tr></thead><tbody>{rows.map(r=><tr key={r.imdb_id}><td><b>{r.display_title}</b><small>{r.original_title&&r.original_title!==r.display_title?r.original_title:r.imdb_id}</small></td><td>{r.year||'—'}</td><td>{typeLabel(r.type)}</td><td>{r.final_rating!=null?Number(r.final_rating).toFixed(1):'—'}</td><td>{r.imdb_rating!=null?Number(r.imdb_rating).toFixed(1):'—'}</td><td className="reason-cell" title={r.reason||''}>{r.reason||'Sin motivo'}</td><td>{date(r.excluded_at)}</td><td><form action={restoreTitle}><input type="hidden" name="imdbId" value={r.imdb_id}/><input type="hidden" name="returnTo" value={restoreReturn}/><button>Restaurar</button></form></td></tr>)}</tbody></table></div>}

    {total>pageSize&&<nav className="excluded-pagination" aria-label="Paginación"><Link className={safePage<=1?'disabled':''} href={pageHref(Math.max(1,safePage-1))}>‹</Link>{safePage>2&&<Link href={pageHref(1)}>1</Link>}{safePage>3&&<span>…</span>}{[safePage-1,safePage,safePage+1].filter(x=>x>=1&&x<=pages).map(x=><Link key={x} className={x===safePage?'active':''} href={pageHref(x)}>{x}</Link>)}{safePage<pages-2&&<span>…</span>}{safePage<pages-1&&<Link href={pageHref(pages)}>{pages}</Link>}<Link className={safePage>=pages?'disabled':''} href={pageHref(Math.min(pages,safePage+1))}>›</Link></nav>}
  </div>;
}
