import Link from 'next/link';
import {MediaCard} from '@/components/MediaCard';
import {getCatalog,getCatalogFilters,getCatalogStats} from '@/lib/queries';
import {markAcquiring,excludeTitle,restoreTitle} from '@/app/actions';
import './catalog-v3.css';

export const dynamic='force-dynamic';

function qs(p,patch={}){
  const x=new URLSearchParams();
  for(const[k,v]of Object.entries({...p,...patch})) if(v!==undefined&&v!==null&&v!=='') x.set(k,String(v));
  return x.toString();
}
function pct(n,total){return total?`${Math.round((Number(n||0)/Number(total))*100)}%`:'0%'}
function StateDot({state}){return <span className={`catalog-state-dot ${state}`} aria-hidden="true"/>}

export default async function Catalogo({searchParams}){
  const p=await searchParams;
  const view=p.view==='list'?'list':'grid';
  const [rows,f,stats]=await Promise.all([getCatalog(p),getCatalogFilters(),getCatalogStats(p)]);
  const returnTo='/catalogo?'+qs(p,{notice:'',undo:''});
  const type=p.type||'';
  const status=p.status||'';
  const hasFilters=Boolean(p.q||p.genre||p.year||type||status);
  const total=Number(stats.total||0);
  const statItems=[
    ['total','Total títulos',stats.total,'100%'],
    ['missing','Faltan',stats.missing,pct(stats.missing,total)],
    ['acquiring','En proceso',stats.acquiring,pct(stats.acquiring,total)],
    ['plex','En Plex',stats.in_plex,pct(stats.in_plex,total)]
  ];

  return <div className="catalog-v3 catalog-v3-rebuild">
    <header className="catalog-topline">
      <div>
        <div className="eyebrow">Biblioteca audiovisual</div>
        <h1>Catálogo</h1>
        <p>Explora, filtra y gestiona todos los títulos de PikoFilm.</p>
      </div>
      <Link className="catalog-excluded" href="/catalogo/excluidas">◉ Excluidas</Link>
    </header>

    {p.notice==='excluded'&&p.undo&&<div className="toast success catalog-toast">
      <span>Título excluido correctamente.</span>
      <form action={restoreTitle}><input type="hidden" name="imdbId" value={p.undo}/><input type="hidden" name="returnTo" value={returnTo}/><button>Deshacer</button></form>
    </div>}

    <section className="catalog-control-deck" aria-label="Buscar y filtrar catálogo">
      <form method="get" className="catalog-filter-form">
        <input type="hidden" name="view" value={view}/>
        <div className="catalog-searchbox">
          <span aria-hidden="true">⌕</span>
          <input name="q" defaultValue={p.q||''} placeholder="Buscar por título…" aria-label="Buscar película o serie"/>
          {hasFilters&&<Link href="/catalogo" className="catalog-clear">Limpiar filtros</Link>}
        </div>
        <div className="catalog-select-grid">
          <label><span>Tipo</span><select name="type" defaultValue={type}><option value="">Todo</option><option value="movie">Películas</option><option value="series">Series</option></select></label>
          <label><span>Estado</span><select name="status" defaultValue={status}><option value="">Todos</option><option value="missing">Faltan</option><option value="acquiring">En proceso</option><option value="in_plex">En Plex</option></select></label>
          <label><span>Género</span><select name="genre" defaultValue={p.genre||''}><option value="">Todos</option>{f.genres.map(g=><option key={g}>{g}</option>)}</select></label>
          <label><span>Año</span><select name="year" defaultValue={p.year||''}><option value="">Todos</option>{f.years.map(y=><option key={y}>{y}</option>)}</select></label>
          <button className="catalog-apply">Aplicar filtros</button>
        </div>
      </form>
      <div className="catalog-view-switch" aria-label="Vista">
        <span>Vista</span>
        <div><Link className={view==='grid'?'active':''} href={'/catalogo?'+qs(p,{view:'grid'})} title="Carátulas">▦</Link><Link className={view==='list'?'active':''} href={'/catalogo?'+qs(p,{view:'list'})} title="Lista">☷</Link></div>
      </div>
    </section>

    <section className="catalog-stat-strip" aria-label="Resumen del catálogo">
      {statItems.map(([kind,label,value,percent])=><article key={kind} className={`catalog-stat ${kind}`}>
        <StateDot state={kind}/><div><strong>{Number(value||0).toLocaleString('es-ES')}</strong><span>{label}</span></div><small>{percent}</small>
      </article>)}
    </section>

    <div className="catalog-resultbar">
      <span>Mostrando <b>{rows.length.toLocaleString('es-ES')}</b> de <b>{total.toLocaleString('es-ES')}</b> títulos{hasFilters?' filtrados':''}</span>
      <span className="catalog-context-note">La ficha conserva tu búsqueda y filtros</span>
    </div>

    {rows.length===0?<div className="catalog-empty"><b>No hay títulos con estos criterios</b><span>Prueba a limpiar o cambiar los filtros.</span></div>:view==='grid'?
      <div className="media-grid catalog-poster-grid">{rows.map(r=><article className="media-action catalog-poster-item" key={r.imdb_id}>
        <div className="catalog-poster-wrap"><MediaCard item={r} href={`/catalogo/${r.imdb_id}?from=${encodeURIComponent(returnTo)}`}/><span className={`catalog-poster-status ${r.effective_status||'missing'}`} title={r.effective_status==='in_plex'?'En Plex':r.effective_status==='acquiring'?'En proceso':'Falta'}>{r.effective_status==='in_plex'?'✓':r.effective_status==='acquiring'?'⋯':'!'}</span></div>
        {r.effective_status!=='in_plex'&&<div className="quick-actions"><form action={markAcquiring}><input type="hidden" name="imdbId" value={r.imdb_id}/><button>+ En proceso</button></form><form action={excludeTitle}><input type="hidden" name="imdbId" value={r.imdb_id}/><input type="hidden" name="returnTo" value={returnTo}/><button className="danger-soft">Excluir</button></form></div>}
      </article>)}</div>:
      <div className="modern-list catalog-modern-list">{rows.map(r=><article key={r.imdb_id}><div className="list-main"><Link className="title" href={`/catalogo/${r.imdb_id}?from=${encodeURIComponent(returnTo)}`}>{r.display_title}</Link><span>{r.year||'—'} · {r.type==='Película'?'Película':'Serie'} · ⭐ {r.final_rating??'—'} · {(r.imdb_votes||0).toLocaleString('es-ES')} votos</span></div><div className="list-actions"><span className={`catalog-list-state ${r.effective_status||'missing'}`}><StateDot state={r.effective_status==='in_plex'?'plex':r.effective_status==='acquiring'?'acquiring':'missing'}/>{r.effective_status==='in_plex'?'En Plex':r.effective_status==='acquiring'?'En proceso':'Falta'}</span>{r.effective_status!=='in_plex'&&<><form action={markAcquiring}><input type="hidden" name="imdbId" value={r.imdb_id}/><button>En proceso</button></form><form action={excludeTitle}><input type="hidden" name="imdbId" value={r.imdb_id}/><input type="hidden" name="returnTo" value={returnTo}/><button>Excluir</button></form></>}</div></article>)}</div>}
  </div>;
}
