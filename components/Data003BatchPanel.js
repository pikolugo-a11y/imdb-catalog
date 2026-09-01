import Link from 'next/link';
import ActionButton from './ActionButton';
import BatchAutoRefresh from './BatchAutoRefresh';
import Data001BatchPanel from './Data001BatchPanel';
import Data002BatchPanel from './Data002BatchPanel';
import {getData001BatchPanelState} from '@/lib/data001-batch';
import {getData002BatchPanelState} from '@/lib/data002-batch';
import {startData003BatchAction,pauseData003BatchAction,resumeData003BatchAction,cancelData003BatchAction} from '@/app/calidad/datos/batch-actions';

const nf=n=>Number(n||0).toLocaleString('es-ES');
function pct(done,total){return total?Math.min(100,Math.round((Number(done||0)*1000)/Number(total))/10):0}

export default async function Data003BatchPanel({state}){
  const [data001,data002]=await Promise.all([getData001BatchPanelState(),getData002BatchPanelState()]);
  const active=state?.active||null,latest=state?.latest||null,enginePaused=state?.engine?.desired_state==='paused';
  const run=active||latest,total=Number(run?.items_total||0),processed=Number(run?.items_processed||0),succeeded=Number(run?.items_succeeded||0),failed=Number(run?.items_failed||0),pending=Number(run?.items_pending||0);
  const paused=active?.desired_state==='paused'||enginePaused,cancelling=active?.desired_state==='cancel_requested';
  const anyActive=Boolean(data001?.active||data002?.active||active);
  return <details className="batch-hub" open={anyActive}>
    <summary className="batch-hub-summary"><div><span className="cap">Procesos masivos</span><strong>Procesos Batch</strong><small>{nf(Number(data001?.eligibleCount||0)+Number(data002?.eligibleCount||0)+Number(state?.eligibleCount||0))} acciones pendientes · 3 procesos disponibles</small></div><span className={`batch-pill ${anyActive?'running':'idle'}`}>{anyActive?'En curso':'Mostrar Batch'}</span></summary>
    <div className="batch-hub-list">
      <Data001BatchPanel state={data001}/>
      <Data002BatchPanel state={data002}/>
      <details className="batch-process" open={Boolean(active)}>
        <summary className="batch-process-summary"><div><span className="cap">DATA-003</span><strong>Calcular PikoScore masivamente</strong></div><div className="batch-process-meta"><span>{nf(state?.eligibleCount)} pendientes</span><span className={`batch-pill ${active?paused?'paused':'running':'idle'}`}>{active?(cancelling?'Cancelando':paused?'Pausado':'En curso'):'Disponible'}</span></div></summary>
        <section className="batch-panel batch-panel-nested" aria-label="Batch PikoScore">
          <BatchAutoRefresh active={Boolean(active)} paused={paused}/>
          <div className="batch-panel-head"><div><p>Ejecuta el mismo proceso individual para todos los títulos que están listos para PikoScore.</p></div></div>
          {!active&&<div className="batch-idle"><div><strong>{nf(state?.eligibleCount)} pendientes</strong><small>Selección canónica: datos completos + ratings suficientes y frescos + PikoScore no vigente.</small></div><ActionButton action={startData003BatchAction} label="Iniciar Batch" pendingLabel="Preparando Batch…" className="button"/></div>}
          {active&&<><div className="batch-progress-line"><div className="batch-progress"><span style={{width:`${pct(processed,total)}%`}}/></div><b>{nf(processed)} / {nf(total)} · {pct(processed,total)} %</b></div><div className="batch-kpis"><span>✓ Correctos <b>{nf(succeeded)}</b></span><span>⚠ Errores <b>{nf(failed)}</b></span><span>Pendientes <b>{nf(pending)}</b></span><span>Concurrencia <b>{nf(active.requested_concurrency)}</b></span></div>{enginePaused&&<p className="batch-warning">Pausa global activa desde Centro de Operaciones. Este Batch no reclamará nuevos títulos.</p>}<div className="batch-actions">{!cancelling&&(paused?<ActionButton action={resumeData003BatchAction} fields={{runId:active.run_id}} label="Continuar" pendingLabel="Reanudando…" className="button"/>:<ActionButton action={pauseData003BatchAction} fields={{runId:active.run_id}} label="Pausar" pendingLabel="Pausando…" className="button ghost"/>)}<ActionButton action={cancelData003BatchAction} fields={{runId:active.run_id}} label="Cancelar" pendingLabel="Cancelando…" className="button ghost"/><Link className="button ghost" href={`/admin/runs/${active.run_id}`}>Ver en Centro de Operaciones</Link></div></>}
          {!active&&latest&&<div className="batch-last"><span>Última ejecución: <b>{latest.technical_status}</b> · {nf(processed)}/{nf(total)}</span><Link href={`/admin/runs/${latest.run_id}`}>Ver detalle →</Link></div>}
        </section>
      </details>
    </div>
  </details>;
}
