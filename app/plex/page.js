import Link from 'next/link';
import PlexSyncButton from '@/components/PlexSyncButton';
import Segmented from '@/components/Segmented';
import {getPlexLibrary,getPlexSummary} from '@/lib/plex-queries-v2';
import './plex-library.css';

export const dynamic='force-dynamic';

function qs(p,patch={}){const x=new URLSearchParams();for(const[k,v]of Object.entries({...p,...patch}))if(v!==undefined&&v!==null&&v!=='')x.set(k,String(v));return x.toString()}
function fmtDate(v){if(!v)return '—';try{return new Date(v).toLocaleDateString('es-ES',{day:'2-digit',month:'2-digit',year:'numeric'})}catch{return '—'}}
function fmtSync(v){if(!v)return 'Sin registrar';try{return new Date(v).toLocaleString('es-ES')}catch{return 'Sin registrar'}}

export default async function Plex({searchParams}){
  const p=await searchParams;
  const type=p.type||'';
  const [s,d]=await Promise.all([getPlexSummary(),getPlexLibrary({...p,mode:'uncatalogued'})]);
  const rows=d.rows;
  return <div className="plex-inbox">
    <div className="page-head plex-head">
      <div>
        <div className="eyebrow">PLEX → NOVEDADES → CATÁLOGO</div>
        <h1>Mi Biblioteca</h1>
        <p>Plex detecta títulos físicos. Si aún no existen en Catálogo, se envían a Novedades para usar la misma puerta de entrada que Discovery y Manual.</p>
      </div>
      <div className="plex-sync-block">
        <span className="plex-sync-label">Última sincronización</span>
        <strong>{fmtSync(s.last_sync)}</strong>
        <PlexSyncButton/>
      </div>
    </div>

    <div className="plex-summary-strip plex-summary-compact">
      <div><span className="plex-summary-number">{s.outside_catalog.toLocaleString('es-ES')}</span><span><b>Títulos de Plex aún no incorporados al catálogo</b><small>La sincronización los crea/actualiza en Novedades; desde allí siguen el flujo común.</small></span></div>
      <div className="plex-linked-note"><span>✓</span><span><b>{s.in_catalog.toLocaleString('es-ES')} ya vinculados</b><small>Gestionados desde Catálogo y sus colas de Calidad</small></span></div>
    </div>

    <div className="plex-toolbar">
      <Segmented value={type} items={[
        {value:'',label:'Todos',count:s.outside_catalog,href:'/plex?'+qs(p,{type:'',page:1})},
        {value:'movie',label:'Películas',href:'/plex?'+qs(p,{type:'movie',page:1})},
        {value:'series',label:'Series',href:'/plex?'+qs(p,{type:'series',page:1})}
      ]}/>
      <form className="plex-search" method="get">
        <input type="hidden" name="type" value={type}/><input type="hidden" name="page" value="1"/>
        <input name="q" defaultValue={p.q||''} placeholder="Buscar título…"/>
        <input name="year" defaultValue={p.year||''} placeholder="Año" inputMode="numeric"/>
        <button>Filtrar</button>
        {(p.q||p.year)&&<Link href={'/plex?'+qs(p,{q:'',year:'',page:1})} className="filter-reset">Limpiar</Link>}
      </form>
    </div>

    {rows.length?<>
      <div className="plex-table-wrap">
        <table className="plex-table">
          <thead><tr><th>Título en Plex</th><th>Tipo</th><th>Año</th><th>IMDb</th><th>Añadido a Plex</th><th></th></tr></thead>
          <tbody>{rows.map(r=>{
            const title=r.plex_title||'Sin título';
            const original=r.original_title&&r.original_title!==title?r.original_title:null;
            return <tr key={r.rating_key} className={!r.imdb_id?'plex-row-attention':''}>
              <td><div className="plex-title"><b>{title}</b>{original&&<span className="plex-original">{original}</span>}<small>Plex #{r.rating_key}</small></div></td>
              <td><span className="plex-type">{r.item_type==='show'?'Serie':'Película'}</span></td>
              <td>{r.plex_year||<span className="plex-year-missing" title="Plex no informa del año">—</span>}</td>
              <td>{r.imdb_id?<span className="plex-imdb">{r.imdb_id}</span>:<span className="plex-pending">● Sin IMDb</span>}</td>
              <td>{fmtDate(r.added_at)}</td>
              <td className="plex-action">{r.imdb_id?<Link className="button primary" href={`/novedades?q=${encodeURIComponent(r.imdb_id)}`}>Ver en Novedades</Link>:<Link className="button ghost" href={`/calidad/identidad?plex=${encodeURIComponent(r.rating_key)}&q=${encodeURIComponent(title)}`}>Resolver identidad</Link>}</td>
            </tr>})}</tbody>
        </table>
      </div>
      <div className="plex-table-foot"><span>{d.total.toLocaleString('es-ES')} pendientes</span><span>Página {d.page} de {d.pages}</span></div>
      {d.pages>1&&<nav className="pager"><span>{d.page>1?<Link className="button ghost" href={'/plex?'+qs(p,{page:d.page-1})}>← Anterior</Link>:null}</span><span></span><span>{d.page<d.pages?<Link className="button ghost" href={'/plex?'+qs(p,{page:d.page+1})}>Siguiente →</Link>:null}</span></nav>}
    </>:<div className="plex-empty"><div>✓</div><h2>Todo al día</h2><p>No hay títulos nuevos en Plex pendientes de incorporar al catálogo.</p></div>}
  </div>;
}
