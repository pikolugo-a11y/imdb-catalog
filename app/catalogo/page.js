import Link from 'next/link';
import Kpi from '@/components/Kpi';
import {MediaCard} from '@/components/MediaCard';
import Segmented from '@/components/Segmented';
import {getCatalog,getCatalogFilters,getCatalogStats} from '@/lib/queries';
import {markAcquiring,excludeTitle,restoreTitle} from '@/app/actions';
import './catalog-v3.css';

export const dynamic='force-dynamic';

function qs(p,patch={}){
  const x=new URLSearchParams();
  for(const[k,v]of Object.entries({...p,...patch})) if(v!==undefined&&v!==null&&v!=='') x.set(k,String(v));
  return x.toString();
}

export default async function Catalogo({searchParams}){
  const p=await searchParams;
  const view=p.view==='list'?'list':'grid';
  const [rows,f,stats]=await Promise.all([getCatalog(p),getCatalogFilters(),getCatalogStats(p)]);
  const returnTo='/catalogo?'+qs(p,{notice:'',undo:''});
  const type=p.type||'';
  const status=p.status||'';
  const hasFilters=Boolean(p.q||p.genre||p.year||type||status);

  return <div className="catalog-v3">
    <section className="catalog-hero">
      <div>
        <div className="eyebrow">Biblioteca audiovisual</div>
        <h1>Catálogo</h1>
        <p>Explora toda tu base de datos, localiza lo que falta y decide qué incorporar a Plex.</p>
      </div>
      <div className="catalog-tools">
        <Link className="button secondary excluded-link" href="/catalogo/excluidas">Excluidas</Link>
        <Segmented value={view} items={[
          {value:'grid',label:'▦ Carátulas',href:'/catalogo?'+qs(p,{view:'grid'})},
          {value:'list',label:'☷ Lista',href:'/catalogo?'+qs(p,{view:'list'})}
        ]}/>
      </div>
    </section>

    {p.notice==='excluded'&&p.undo&&<div className="toast success">
      <span>Título excluido correctamente.</span>
      <form action={restoreTitle}>
        <input type="hidden" name="imdbId" value={p.undo}/>
        <input type="hidden" name="returnTo" value={returnTo}/>
        <button>Deshacer</button>
      </form>
    </div>}

    <section className="catalog-kpis" aria-label="Resumen del catálogo">
      <Kpi label="Resultados" value={stats.total}/>
      <Kpi label="En Plex" value={stats.in_plex}/>
      <Kpi label="En proceso" value={stats.acquiring}/>
      <Kpi label="Faltan" value={stats.missing}/>
    </section>

    <section className="catalog-filter-panel" aria-label="Filtros del catálogo">
      <div className="catalog-filter-quick">
        <div className="catalog-filter-group">
          <span className="filter-label">Tipo</span>
          <Segmented value={type} items={[
            {value:'',label:'Todo',href:'/catalogo?'+qs(p,{type:''})},
            {value:'movie',label:'Películas',href:'/catalogo?'+qs(p,{type:'movie'})},
            {value:'series',label:'Series',href:'/catalogo?'+qs(p,{type:'series'})}
          ]}/>
        </div>
        <div className="catalog-filter-group">
          <span className="filter-label">Estado</span>
          <Segmented value={status} items={[
            {value:'',label:'Todos',href:'/catalogo?'+qs(p,{status:''})},
            {value:'missing',label:'Faltan',href:'/catalogo?'+qs(p,{status:'missing'})},
            {value:'acquiring',label:'En proceso',href:'/catalogo?'+qs(p,{status:'acquiring'})},
            {value:'in_plex',label:'En Plex',href:'/catalogo?'+qs(p,{status:'in_plex'})}
          ]}/>
        </div>
      </div>
      <form className="catalog-search-row" method="get">
        <input type="hidden" name="view" value={view}/>
        <input type="hidden" name="type" value={type}/>
        <input type="hidden" name="status" value={status}/>
        <input name="q" defaultValue={p.q||''} placeholder="Buscar película o serie…" aria-label="Buscar película o serie"/>
        <select name="genre" defaultValue={p.genre||''} aria-label="Género">
          <option value="">Todos los géneros</option>
          {f.genres.map(g=><option key={g}>{g}</option>)}
        </select>
        <select name="year" defaultValue={p.year||''} aria-label="Año">
          <option value="">Todos los años</option>
          {f.years.map(y=><option key={y}>{y}</option>)}
        </select>
        <button>Aplicar</button>
        <Link href="/catalogo" className="filter-reset">Limpiar</Link>
      </form>
    </section>

    <div className="catalog-result-head">
      <span><b>{stats.total.toLocaleString('es-ES')}</b> títulos{hasFilters?' con los filtros actuales':''}</span>
      <span className="catalog-result-hint">Abre una ficha sin perder el contexto del catálogo</span>
    </div>

    {rows.length===0?<div className="catalog-empty"><b>No hay títulos con estos criterios</b><span>Prueba a limpiar o cambiar los filtros.</span></div>:view==='grid'?
      <div className="media-grid">{rows.map(r=><div className="media-action" key={r.imdb_id}>
        <MediaCard item={r} href={`/catalogo/${r.imdb_id}?from=${encodeURIComponent(returnTo)}`}/>
        {r.effective_status!=='in_plex'&&<div className="quick-actions">
          <form action={markAcquiring}><input type="hidden" name="imdbId" value={r.imdb_id}/><button>+ En proceso</button></form>
          <form action={excludeTitle}><input type="hidden" name="imdbId" value={r.imdb_id}/><input type="hidden" name="returnTo" value={returnTo}/><button className="ghost danger-soft">Excluir</button></form>
        </div>}
      </div>)}</div>:
      <div className="modern-list">{rows.map(r=><article key={r.imdb_id}>
        <div className="list-main">
          <Link className="title" href={`/catalogo/${r.imdb_id}?from=${encodeURIComponent(returnTo)}`}>{r.display_title}</Link>
          <span>{r.year||'—'} · {r.type==='Película'?'Película':'Serie'} · ⭐ {r.final_rating??'—'} · {(r.imdb_votes||0).toLocaleString('es-ES')} votos</span>
        </div>
        <div className="list-actions">
          <span className={`status ${r.effective_status==='in_plex'?'ok':'warn'}`}>{r.effective_status==='in_plex'?'En Plex':r.effective_status==='acquiring'?'En proceso':'Falta'}</span>
          {r.effective_status!=='in_plex'&&<>
            <form action={markAcquiring}><input type="hidden" name="imdbId" value={r.imdb_id}/><button>En proceso</button></form>
            <form action={excludeTitle}><input type="hidden" name="imdbId" value={r.imdb_id}/><input type="hidden" name="returnTo" value={returnTo}/><button className="ghost danger-soft">Excluir</button></form>
          </>}
        </div>
      </article>)}</div>}
  </div>;
}
