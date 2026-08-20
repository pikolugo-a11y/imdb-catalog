import Link from 'next/link';
import EnrichTitleButton from '@/components/EnrichTitleButton';
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
        <div className="eyebrow">PLEX → PIKOFILM</div>
        <h1>Mi Biblioteca</h1>
        <p>Nuevos títulos detectados en Plex que todavía no forman parte del catálogo.</p>
      </div>
      <div className="plex-sync-block">
        <span className="plex-sync-label">Última sincronización</span>
        <strong>{fmtSync(s.last_sync)}</strong>
        <PlexSyncButton/>
      </div>
    </div>

    <div className="plex-summary-strip">
      <div><span className="plex-summary-number">{s.outside_catalog}</span><span><b>pendientes de incorporar</b><small>Desaparecen de aquí al añadirlos al catálogo</small></span></div>
      <div className="plex-summary-ok"><span>✓</span><span><b>{s.in_catalog.toLocaleString('es-ES')} ya vinculados</b><small>Gestionados desde Catálogo y Calidad</small></span></div>
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
          <thead><tr><th>Título en Plex</th><th>Tipo</th><th>Año</th><th>IMDb</th><th>Detectado</th><th>Estado</th><th></th></tr></thead>
          <tbody>{rows.map(r=><tr key={r.rating_key}>
            <td><div className="plex-title"><b>{r.plex_title||'Sin título'}</b><small>Plex #{r.rating_key}</small></div></td>
            <td><span className="plex-type">{r.item_type==='show'?'Serie':'Película'}</span></td>
            <td>{r.plex_year||'—'}</td>
            <td>{r.imdb_id?<span className="plex-imdb">{r.imdb_id}</span>:<span className="plex-muted">Sin identificar</span>}</td>
            <td>{fmtDate(r.added_at)}</td>
            <td>{r.imdb_id?<span className="plex-ready">● Listo para añadir</span>:<span className="plex-pending">● Requiere identidad</span>}</td>
            <td className="plex-action">{r.imdb_id?<EnrichTitleButton imdbId={r.imdb_id} label="+ Añadir al catálogo" className="primary"/>:<Link className="button ghost" href={`/calidad/identidad?plex=${encodeURIComponent(r.rating_key)}&q=${encodeURIComponent(r.plex_title||'')}`}>Resolver identidad</Link>}</td>
          </tr>)}</tbody>
        </table>
      </div>
      <div className="plex-table-foot"><span>{d.total.toLocaleString('es-ES')} pendientes</span><span>Página {d.page} de {d.pages}</span></div>
      {d.pages>1&&<nav className="pager"><span>{d.page>1?<Link className="button ghost" href={'/plex?'+qs(p,{page:d.page-1})}>← Anterior</Link>:null}</span><span></span><span>{d.page<d.pages?<Link className="button ghost" href={'/plex?'+qs(p,{page:d.page+1})}>Siguiente →</Link>:null}</span></nav>}
    </>:<div className="plex-empty"><div>✓</div><h2>Todo al día</h2><p>No hay títulos nuevos en Plex pendientes de incorporar al catálogo.</p></div>}
  </div>;
}
