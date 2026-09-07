import ActionButton from './ActionButton';
import {db} from '@/lib/db';
import {pauseAllGenericBatchesAction,resumeAllGenericBatchesAction,pauseBatchAction,resumeBatchAction,cancelBatchAction} from '@/app/admin/batch-engine-actions';

export default async function OperationsBatchControl(){
  const sql=db();
  const[[engine],active]=await Promise.all([
    sql.query(`SELECT desired_state,pause_reason,changed_at FROM batch_engine_control WHERE singleton_id=1`),
    sql.query(`SELECT brc.run_id,brc.process_code,brc.desired_state,pr.items_total,pr.items_processed,pr.items_succeeded,pr.items_failed,pr.items_pending FROM batch_run_control brc JOIN process_runs pr ON pr.run_id=brc.run_id WHERE brc.closed_at IS NULL ORDER BY brc.created_at DESC LIMIT 20`)
  ]);
  const paused=engine?.desired_state==='paused';
  return <section className="ops-panel"><div className="ops-panel-head"><div><span className="ops-label">Batch Engine</span><h2>Control global</h2></div><span className={`ops-badge ${paused?'warn':'ok'}`}>{paused?'Pausado':'Operativo'}</span></div><p>{active.length} Batch activo(s). La pausa global deja terminar los items ya iniciados y evita reclamar nuevos.</p>{paused?<ActionButton action={resumeAllGenericBatchesAction} label="Reactivar todos los Batch" pendingLabel="Reactivando…" className="button"/>:<ActionButton action={pauseAllGenericBatchesAction} label="Pausar todos los Batch" pendingLabel="Pausando…" className="button ghost"/>}{active.length>0&&<div className="ops-processes">{active.map(r=>{const locallyPaused=r.desired_state==='paused',effectivePaused=paused||locallyPaused;return <div key={r.run_id}><strong>{r.process_code}</strong><span>{Number(r.items_processed||0)}/{Number(r.items_total||0)} procesados · {Number(r.items_pending||0)} pendientes · {Number(r.items_failed||0)} fallidos{effectivePaused?' · PAUSADO':''}</span><div style={{display:'flex',gap:8,flexWrap:'wrap',marginTop:8}}>{!paused&&(locallyPaused?<ActionButton action={resumeBatchAction} fields={{runId:r.run_id}} label="Reanudar" pendingLabel="Reanudando…" className="button"/>:<ActionButton action={pauseBatchAction} fields={{runId:r.run_id}} label="Pausar" pendingLabel="Pausando…" className="button ghost"/>)}<ActionButton action={cancelBatchAction} fields={{runId:r.run_id}} label="Cancelar" pendingLabel="Cancelando…" className="button ghost"/></div></div>})}</div>}</section>;
}
