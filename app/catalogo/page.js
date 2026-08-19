import Link from 'next/link';
import {MediaCard} from '@/components/MediaCard';
import CatalogFiltersV3 from '@/components/CatalogFiltersV3';
import {getCatalogV3,getCatalogFiltersV3,getCatalogStatsV3,catalogPageSize} from '@/lib/catalog-v3-queries';
import {markAcquiring,excludeTitle,restoreTitle} from '@/app/actions';
import './catalog-v3.css';

export const dynamic='force-dynamic';

function qs(p,patch={}){
  const x=new URLSearchParams();
  const source={...p,...patch};
  for(const[k,v]of Object.entries(source)){
    const value=Array.isArray(v)?v.join(','):v;
    if(value!==undefined&&value!==null&&value!=='')x.set(k,String(value));
  }
  return x.toString();
}
function pct(n,total){return total?`${Math.round((Number(n||0)/Number(total))*100)}%`:'0%'}
function StateIcon({kind}){const icons={total:'▦',missing:'!',acquiring:'⋯',plex:'✓'};return <span className={`catalog-stat-icon ${kind}`} aria-hidden="true">{icons[kind]}</span>}
function StateDot({state}){return <span className={`catalog-state-dot ${state}`} aria-hidden="true"/>}
function list(v){const raw=Array.isArray(v)?v.join(','):String(v||'');return [...new Set(raw.split(',').map(x=>x.trim()).filter(Boolean))]}
function n(v){const x=Number.parseInt(Array.isArray(v)?v[0]:v,10);return Number.isFinite(x)?x:null}

export default async function Catalogo({searchParams}){
  const p=await searchParams;
  const view=p.view==='list'?'list':'grid';
  const [rows,f,stats]=await Promise.all([getCatalogV3(p),getCatalogFiltersV3(),getCatalogStatsV3(p)]);
  const page=Math.max(1,n(p.page)||1);
  const pageSize=catalogPageSize();
  const total=Number(stats.total||0);
  const pages=Math.max(1,Math.ceil(total/pageSize));
  const safePage=Math.min(page,pages);
  const first=total?((safePage-1)*pageSize)+1:0;
  const last=Math.min(safePage*pageSize,total);
  const returnTo='/catalogo?'+qs(p,{notice:'',undo:''});
  const genres=list(p.genres||p.genre);
  const legacyYear=n(p.year);
  const initial={q:String(p.q||''),type:String(p.type||''),status:String(p.status||''),genres,genreMode:p.genreMode==='all'?'all':'any',yearFrom:n(p.yearFrom)??legacyYear??'',yearTo:n(p.yearTo)??legacyYear??''};
  const hasFilters=Boolean(initial.q||initial.type||initial.status||genres.length||initial.yearFrom||initial.yearTo);
  const statItems=[['total','Total títulos',stats.total,'100%'],['missing','Faltan',stats.missing,pct(stats.missing,total)],['acquiring','En proceso',stats.acquiring,pct(stats.acquiring,total)],['plex','En Plex',stats.in_plex,pct(stats.in_plex,total)]];
  const pageHref=x=>'/catalogo?'+qs(p,{page:x});

  return <div className="catalog-v3 catalog-v3-rebuild">
    <header className="catalog-topline">
      <div><div className="eyebrow">Biblioteca audiovisual</div><h1>Catálogo</h1><p>Explora, filtra y gestiona todos los títulos de PikoFilm.</p></div>
      <Link className="catalog-excluded" href="/catalogo/excluidas">◉ Excluidas</Link>
    </header>

    {p.notice==='excluded'&&p.undo&&<div className="toast success catalog-toast"><span>Título excluido correctamente.</span><form action={restoreTitle}><input type="hidden" name="imdbId" value={p.undo}/><input type="hidden" name="returnTo" value={returnTo}/><button>Deshacer</button></form></div>}

    <div className="catalog-filter-shell">
      <CatalogFiltersV3 genres={f.genres} minYear={f.minYear} maxYear={f.maxYear} initial={initial}/>
      <div className="catalog-view-switch" aria-label="Vista"><span>Vista</span><div><Link className={view==='grid'?'active':''} href={'/catalogo?'+qs(p,{view:'grid',page:1})} title="Carátulas">▦</Link><Link className={view==='list'?'active':''} href={'/catalogo?'+qs(p,{view:'list',page:1})} title="Lista">☷</Link></div></div>
    </div>

    <section className="catalog-stat-strip" aria-label="Resumen del catálogo">{statItems.map(([kind,label,value,percent])=><article key={kind} className={`catalog-stat ${kind}`}><StateIcon kind={kind}/><div><strong>{Number(value||0).toLocaleString('es-ES')}</strong><span>{label}</span></div><small>{percent}</small></article>)}</section>

    <div className="catalog-resultbar"><span>Mostrando <b>{first.toLocaleString('es-ES')}–{last.toLocaleString('es-ES')}</b> de <b>{total.toLocaleString('es-ES')}</b> títulos{hasFilters?' filtrados':''}</span><span className="catalog-context-note">La ficha conserva tu búsqueda y filtros</span></div>

    {rows.length===0?<div className="catalog-empty"><b>No hay títulos con estos criterios</b><span>Prueba a limpiar o cambiar los filtros.</span></div>:view==='grid'?
      <div className="media-grid catalog-poster-grid">{rows.map(r=><article className="media-action catalog-poster-item" key={r.imdb_id}><div className="catalog-poster-wrap"><MediaCard item={r} href={`/catalogo/${r.imdb_id}?from=${encodeURIComponent(returnTo)}`}/><span className={`catalog-poster-status ${r.effective_status||'missing'}`} title={r.effective_status==='in_plex'?'En Plex':r.effective_status==='acquiring'?'En proceso':'Falta'}>{r.effective_status==='in_plex'?'✓':r.effective_status==='acquiring'?'⋯':'!'}</span></div>{r.effective_status!=='in_plex'&&<div className="quick-actions"><form action={markAcquiring}><input type="hidden" name="imdbId" value={r.imdb_id}/><button>+ En proceso</button></form><form action={excludeTitle}><input type="hidden" name="imdbId" value={r.imdb_id}/><input type="hidden" name="returnTo" value={returnTo}/><button className="danger-soft">Excluir</button></form></div>}</article>)}</div>:
      <div className="modern-list catalog-modern-list">{rows.map(r=><article key={r.imdb_id}><div className="list-main"><Link className="title" href={`/catalogo/${r.imdb_id}?from=${encodeURIComponent(returnTo)}`}>{r.display_title}</Link><span>{r.year||'—'} · {r.type==='Película'?'Película':'Serie'} · ⭐ {r.final_rating??'—'} · {(r.imdb_votes||0).toLocaleString('es-ES')} votos</span></div><div className="list-actions"><span className={`catalog-list-state ${r.effective_status||'missing'}`}><StateDot state={r.effective_status==='in_plex'?'plex':r.effective_status==='acquiring'?'acquiring':'missing'}/>{r.effective_status==='in_plex'?'En Plex':r.effective_status==='acquiring'?'En proceso':'Falta'}</span>{r.effective_status!=='in_plex'&&<><form action={markAcquiring}><input type="hidden" name="imdbId" value={r.imdb_id}/><button>En proceso</button></form><form action={excludeTitle}><input type="hidden" name="imdbId" value={r.imdb_id}/><input type="hidden" name="returnTo" value={returnTo}/><button>Excluir</button></form></>}</div></article>)}</div>}

    {total>pageSize&&<nav className="catalog-pagination" aria-label="Paginación"><Link className={safePage<=1?'disabled':''} href={pageHref(Math.max(1,safePage-1))}>‹</Link>{safePage>2&&<Link href={pageHref(1)}>1</Link>}{safePage>3&&<span>…</span>}{[safePage-1,safePage,safePage+1].filter(x=>x>=1&&x<=pages).map(x=><Link key={x} className={x===safePage?'active':''} href={pageHref(x)}>{x}</Link>)}{safePage<pages-2&&<span>…</span>}{safePage<pages-1&&<Link href={pageHref(pages)}>{pages}</Link>}<Link className={safePage>=pages?'disabled':''} href={pageHref(Math.min(pages,safePage+1))}>›</Link></nav>}
  </div>;
}
