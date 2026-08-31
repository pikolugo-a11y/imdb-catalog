import ActionButton from './ActionButton';
import {db} from '@/lib/db';
import {pauseAllGenericBatchesAction,resumeAllGenericBatchesAction} from '@/app/admin/batch-engine-actions';

export default async function OperationsBatchControl(){
  const sql=db();
  const[[engine],active]=await Promise.all([
    sql.query(`SELECT desired_state,pause_reason,changed_at FROM batch_engine_control WHERE singleton_id=1`),
    sql.query(`SELECT count(*)::int n FROM batch_run_control WHERE closed_at IS NULL`)
  ]);
  const paused=engine?.desired_state==='paused';
  return <section className="ops-panel"><div className="ops-panel-head"><div><span className="ops-label">Batch Engine</span><h2>Control global</h2></div><span className={`ops-badge ${paused?'warn':'ok'}`}>{paused?'Pausado':'Operativo'}</span></div><p>{Number(active?.[0]?.n||0)} Batch genérico(s) activos. Este control no afecta a PikoQuality ni a procesos individuales/globales.</p>{paused?<ActionButton action={resumeAllGenericBatchesAction} label="Reactivar todos los Batch" pendingLabel="Reactivando…" className="button"/>:<ActionButton action={pauseAllGenericBatchesAction} label="Pausar todos los Batch" pendingLabel="Pausando…" className="button ghost"/>}</section>;
}
