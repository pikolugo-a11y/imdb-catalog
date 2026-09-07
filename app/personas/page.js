import Link from '@/components/NoPrefetchLink';
import {getPeopleDashboard} from '@/lib/people-dashboard';
import './personas-v4.css';

export const dynamic='force-dynamic';

const image=p=>p?`https://image.tmdb.org/t/p/w185${p}`:null;
const roleLabel=role=>role==='directing'?'Director/a':'Actor / actriz';
const fmtScore=value=>value==null?'—':Number(value).toFixed(2);

export default async function Personas({searchParams}){
  const p=await searchParams,d=await getPeopleDashboard(p);
  const qs=(o={})=>{const x=new URLSearchParams();for(const[k,v]of Object.entries({...p,...o}))if(v!==''&&v!=null)x.set(k,String(v));return`/personas${x.size?`?${x}`:''}`};
  const currentHref=qs({role:d.role,sort:d.sort,page:d.page});
  const personHref=id=>`/personas/${id}?role=${d.role==='directing'?'director':'cast'}&returnTo=${encodeURIComponent(currentHref)}`;
  const first=d.total?((d.page-1)*d.pageSize)+1:0,last=Math.min(d.page*d.pageSize,d.total);
  return <div className="personas-v4">
    <header className="pv4-hero">
      <div><span className="pv4-eyebrow">Explorar por talento</span><h1>Personas</h1><p>Descubre intérpretes y directores por la relevancia real de sus películas, no por acumular créditos.</p></div>
      <Link className="pv4-quality-link" href="/calidad/personas">Calidad de Personas <span aria-hidden="true">↗</span></Link>
    </header>

    <nav className="pv4-tabs" aria-label="Tipo de persona">
      <Link className={d.role==='acting'?'active':''} href={qs({role:'acting',page:1})}>Actores y actrices</Link>
      <Link className={d.role==='directing'?'active':''} href={qs({role:'directing',page:1})}>Directores</Link>
    </nav>

    <section className="pv4-discovery">
      <form className="pv4-tools">
        <label className="pv4-search"><span>Buscar</span><div><i aria-hidden="true">⌕</i><input name="q" defaultValue={p.q||''} placeholder="Nombre de una persona…"/></div></label>
        <label><span>Ordenar por</span><select name="sort" defaultValue={d.sort}><option value="relevance">Destacados · Relevancia</option><option value="score">Mejor PikoScore fiable</option><option value="titles">Filmografía relevante</option><option value="plex">Más en Plex</option></select></label>
        <input type="hidden" name="role" value={d.role}/><button>Aplicar</button>
      </form>
      <div className="pv4-ranking-note"><span aria-hidden="true">✦</span><p><strong>Destacados</strong> prioriza presencia real en PikoFilm/Plex, filmografía relevante y calidad con confianza por número de obras valoradas. Una sola nota alta no domina el ranking.</p></div>
    </section>

    <div className="pv4-toolbar"><div><strong>{first.toLocaleString('es-ES')}–{last.toLocaleString('es-ES')}</strong><span> de {Number(d.total).toLocaleString('es-ES')} personas relevantes</span></div><span>{d.sort==='relevance'?'Orden principal: relevancia':d.sort==='score'?'Orden: PikoScore fiable':d.sort==='titles'?'Orden: filmografía relevante':'Orden: presencia en Plex'}</span></div>

    {d.rows.length===0?<section className="pv4-empty"><strong>No hay personas que coincidan con esta búsqueda</strong><p>Prueba con otro nombre o cambia de interpretación a dirección.</p></section>:<div className="pv4-table-shell">
      <table className="pv4-table"><thead><tr><th>Persona</th><th>Rol</th><th className="num">Filmografía relevante</th><th className="num">PikoScore medio</th><th className="num">En Plex</th><th className="num">Fuera de PikoFilm</th><th></th></tr></thead><tbody>{d.rows.map(x=>{const outside=x.filmography_refreshed_at?Number(x.outside_relevant||0):null;return <tr key={x.tmdb_person_id}><td><Link className="pv4-person" href={personHref(x.tmdb_person_id)}><span className="pv4-avatar">{image(x.profile_path)?<img src={image(x.profile_path)} alt=""/>:<b>👤</b>}</span><span><strong>{x.name}</strong><small>{x.known_for_department||'Cine'}</small></span></Link></td><td><span className="pv4-role">{roleLabel(d.role)}</span></td><td className="num"><strong>{Number(x.role_movies||0)}</strong></td><td className="num pv4-score">{fmtScore(x.avg_score)}<small>{Number(x.scored||0)} valoradas</small></td><td className="num"><strong className="pv4-plex">{Number(x.plex_movies||0)}</strong></td><td className="num"><strong className={outside>0?'pv4-outside':''}>{outside==null?'—':outside}</strong><small>{outside==null?'actualiza la filmografía':outside>0?'por explorar':'sin ausencias detectadas'}</small></td><td><Link className="pv4-go" aria-label={`Abrir ${x.name}`} href={personHref(x.tmdb_person_id)}>→</Link></td></tr>})}</tbody></table>
      <div className="pv4-mobile-list">{d.rows.map(x=>{const outside=x.filmography_refreshed_at?Number(x.outside_relevant||0):null;return <Link className="pv4-mobile-row" key={x.tmdb_person_id} href={personHref(x.tmdb_person_id)}><div className="pv4-mobile-person"><span className="pv4-avatar">{image(x.profile_path)?<img src={image(x.profile_path)} alt=""/>:<b>👤</b>}</span><span><strong>{x.name}</strong><small>{roleLabel(d.role)}</small></span><i>→</i></div><div className="pv4-mobile-metrics"><span><b>{Number(x.role_movies||0)}</b><small>Filmografía</small></span><span><b className="pv4-score">{fmtScore(x.avg_score)}</b><small>PikoScore</small></span><span><b>{Number(x.plex_movies||0)}</b><small>En Plex</small></span><span><b className={outside>0?'pv4-outside':''}>{outside==null?'—':outside}</b><small>Fuera</small></span></div></Link>})}</div>
    </div>}

    {d.pages>1&&<nav className="pv4-pagination" aria-label="Paginación"><Link className={d.page<=1?'disabled':''} href={qs({page:Math.max(1,d.page-1)})}>‹ Anterior</Link><span>Página <strong>{d.page}</strong> de {d.pages}</span><Link className={d.page>=d.pages?'disabled':''} href={qs({page:Math.min(d.pages,d.page+1)})}>Siguiente ›</Link></nav>}
  </div>;
}
