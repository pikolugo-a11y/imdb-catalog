import Link from 'next/link';
import {notFound} from 'next/navigation';
import {getJobDetail} from '@/lib/batch-control';
import {retryEntityAction,setManualReviewAction} from '../../actions';

export const dynamic='force-dynamic';
const dt=v=>v?new Date(v).toLocaleString('es-ES'):'—';
const dur=(a,b)=>a&&b?`${Math.max(0,Math.round((new Date(b)-new Date(a))/1000))} s`:'—';
const label=s=>({IDENTITY_PENDING:'Identidad',IDENTITY_VALIDATION:'Validación identidad',DATA_INCOMPLETE:'Datos principales',PIKOSCORE_PENDING:'PikoScore',MOVIE_FILE_PENDING:'Archivo película',SERIES_SYNC_PENDING:'Series',TECH_PENDING:'PikoQuality'}[s]||s);
const outcomeClass=o=>o==='CORREGIDO'?'ok':o==='ERROR'||o==='REVISION_MANUAL'?'bad':['NO_ENCONTRADO','INCOMPLETO','SIN_CAMBIOS','ACTUALIZADO_SIN_AVANCE'].includes(o)?'warn':'';
const pretty=v=>{if(v===null||v===undefined)return'—';if(typeof v==='string')return v;try{return JSON.stringify(v,null,2)}catch{return String(v)}};

export default async function BatchJobDetail({params}){
  const {id}=await params;
  const detail=await getJobDetail(Number(id));
  if(!detail)notFound();
  const j=detail.job,title=j.title_es||j.title||j.original_title||j.entity_id;
  return <>
    <div className="page-head batch-head"><div><div className="eyebrow">Lifecycle · detalle de job</div><h1>{title}</h1><p>Job #{j.id} · Run #{j.run_id} · {j.entity_id} · {label(j.stage)}</p></div><Link href="/admin/batch">← Volver a Batch</Link></div>
    <section className="section batch-job-detail">
      <div className="batch-job-summary"><div><span>Resultado</span><strong className={`status ${outcomeClass(j.functional_outcome)}`}>{j.functional_outcome||j.status}</strong></div><div><span>Lifecycle</span><strong>{j.lifecycle_before||'—'} → {j.lifecycle_after||'—'}</strong></div><div><span>Intentos</span><strong>{j.attempt_count||j.attempt||0}</strong></div><div><span>Sin progreso</span><strong>{j.no_progress_count||0}</strong></div><div><span>Próximo retry</span><strong>{dt(j.next_retry_at)}</strong></div><div><span>Duración</span><strong>{dur(j.started_at,j.finished_at)}</strong></div></div>
      {j.blocking_reason&&<div className="alert"><b>Bloqueo Lifecycle:</b> {j.blocking_reason}</div>}
      {j.error_message&&<div className="alert"><b>Error:</b> {j.error_message}</div>}
      <div className="batch-control-row"><form action={retryEntityAction}><input type="hidden" name="stage" value={j.stage}/><input type="hidden" name="entityId" value={j.entity_id}/><button>Reintentar ahora</button></form>{j.manual_review?<form action={setManualReviewAction}><input type="hidden" name="stage" value={j.stage}/><input type="hidden" name="entityId" value={j.entity_id}/><input type="hidden" name="enabled" value="false"/><button>Quitar revisión manual</button></form>:<form action={setManualReviewAction}><input type="hidden" name="stage" value={j.stage}/><input type="hidden" name="entityId" value={j.entity_id}/><input type="hidden" name="enabled" value="true"/><input name="reason" placeholder="Motivo opcional"/><button className="danger">Enviar a revisión manual</button></form>}</div>
    </section>
    <section className="section"><div className="section-head"><div><h2>Pasos de ejecución</h2><p>Detalle técnico completo, oculto por defecto. Abre solo el paso que quieras auditar.</p></div></div><div className="process-list">{detail.steps.length?detail.steps.map(s=><details className={`process-card process-${s.status}`} key={s.id}><summary><div><b>{s.step_order}. {s.step_key}</b><span>{s.source||'interno'} · {s.status} · {s.duration_ms??0} ms</span></div><div className="process-stats"><span>{s.attempted?'intentado':'omitido'}</span><span>{s.found===true?'encontrado':s.found===false?'no encontrado':'—'}</span><span>{s.changed?'cambió':'sin cambio'}</span></div></summary><div className="process-detail">{s.reason&&<p><b>Motivo:</b> {s.reason}</p>}{s.error_message&&<div className="alert"><b>{s.error_class||'Error'}:</b> {s.error_message}</div>}<div className="batch-json-grid"><div><b>Antes</b><pre>{pretty(s.before_value)}</pre></div><div><b>Después</b><pre>{pretty(s.after_value)}</pre></div><div><b>Resultado</b><pre>{pretty(s.result)}</pre></div></div></div></details>):<p className="muted">Este job no tiene steps registrados.</p>}</div></section>
    <section className="section"><div className="section-head"><div><h2>Historial del título</h2><p>Intentos anteriores en esta misma etapa.</p></div></div><div className="table-wrap"><table><thead><tr><th>Job</th><th>Run</th><th>Fecha</th><th>Resultado</th><th>Lifecycle</th><th>Error</th></tr></thead><tbody>{detail.history.map(h=><tr key={h.id}><td><Link className="title" href={`/admin/batch/job/${h.id}`}>#{h.id}</Link></td><td>#{h.run_id}</td><td>{dt(h.created_at)}</td><td><span className={`status ${outcomeClass(h.functional_outcome)}`}>{h.functional_outcome||h.status}</span></td><td>{h.lifecycle_before||'—'} → {h.lifecycle_after||'—'}</td><td>{h.error_message||'—'}</td></tr>)}</tbody></table></div></section>
  </>;
}
