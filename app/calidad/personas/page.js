import Link from 'next/link';
import {getPeopleQualityOverview} from '@/lib/people-quality';
import './people-quality.css';

export const dynamic='force-dynamic';
const nf=n=>Number(n||0).toLocaleString('es-ES');
const fmt=d=>d?new Intl.DateTimeFormat('es-ES',{day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'}).format(new Date(d)):'Nunca';
const image=p=>p?`https://image.tmdb.org/t/p/w185${p}`:null;
const labels={never:['Sin actualizar','Nunca se ha ejecutado PER-001'],stale:['Desactualizada','Han pasado más de 30 días'],error:['Error','La última ejecución falló'],ok:['Correcta','Perfil y filmografía vigentes']};

export default async function CalidadPersonas({searchParams}){
  const p=await searchParams;
  const data=await getPeopleQualityOverview(p);
  const qs=(changes={})=>{const x=new URLSearchParams();for(const[k,v]of Object.entries({...p,...changes}))if(v!==undefined&&v!==null&&v!=='')x.set(k,String(v));return`/calidad/personas?${x}`};
  const cards=[['pending','Pendientes',data.summary.pending],['never','Nunca actualizadas',data.summary.never],['stale','Desactualizadas',data.summary.stale],['error','Con error',data.summary.error],['ok','Correctas',data.summary.ok]];
  return <div className="pq-page">
    <header className="pq-head"><div><Link href="/calidad" className="pq-back">← Calidad</Link><span className="eyebrow">CALIDAD · PERSONAS</span><h1>Personas</h1><p>Control de mantenimiento del perfil y filmografía. Esta pantalla detecta qué personas necesitan PER-001; la ficha de Persona sigue siendo el único punto de actualización manual.</p></div><div className="pq-total"><strong>{nf(data.summary.total)}</strong><span>personas relevantes</span></div></header>
    <section className="pq-summary">{cards.map(([key,label,count])=><Link key={key} href={qs({status:key,page:1})} className={`pq-card ${data.status===key?'active':''} pq-${key}`}><span>{label}</span><strong>{nf(count)}</strong><small>{key==='ok'?'al día':key==='pending'?`${nf(data.summary.pending)} requieren acción`:'personas'}</small></Link>)}</section>
    <form className="pq-tools"><input name="q" defaultValue={data.q} placeholder="Buscar persona…"/><input type="hidden" name="status" value={data.status}/><button>Buscar</button><Link href="/calidad/personas">Limpiar</Link></form>
    <div className="pq-list-head"><div><b>{nf(data.filteredTotal)}</b> resultados</div><span>Vigencia: {data.maxAgeDays} días</span></div>
    <div className="pq-table-wrap"><table className="pq-table"><thead><tr><th>Persona</th><th>Estado</th><th>Última actualización</th><th>Filmografía</th><th>Origen en catálogo</th><th>Acción</th></tr></thead><tbody>{data.rows.map(row=>{const meta=labels[row.quality_status]||labels.never;return <tr key={row.tmdb_person_id}><td><Link className="pq-person" href={`/personas/${row.tmdb_person_id}`}><span>{image(row.profile_path)?<img src={image(row.profile_path)} alt=""/>:'👤'}</span><div><b>{row.name}</b><small>{row.known_for_department||'Cine'} · TMDb {row.tmdb_person_id}</small></div></Link></td><td><span className={`pq-status pq-status-${row.quality_status}`}>{meta[0]}</span><small>{meta[1]}</small></td><td><b>{fmt(row.filmography_refreshed_at)}</b>{row.last_run_at&&<small>Último intento: {fmt(row.last_run_at)}</small>}</td><td><strong>{nf(row.filmography_count)}</strong><small>créditos guardados</small></td><td><b>{nf(row.acting_titles)} interpretación</b><small>{nf(row.directed_titles)} dirección</small></td><td><Link className="pq-action" href={`/personas/${row.tmdb_person_id}`}>{row.quality_status==='ok'?'Ver ficha':'Revisar y actualizar'} →</Link></td></tr>})}</tbody></table>{!data.rows.length&&<div className="pq-empty">No hay personas en este estado.</div>}</div>
    {data.pages>1&&<nav className="pq-pages">{data.page>1?<Link href={qs({page:data.page-1})}>← Anterior</Link>:<span/>}<span>Página {data.page} de {data.pages}</span>{data.page<data.pages?<Link href={qs({page:data.page+1})}>Siguiente →</Link>:<span/>}</nav>}
  </div>;
}
