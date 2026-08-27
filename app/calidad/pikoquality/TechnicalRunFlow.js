import {startTechnicalSnapshotAction,pauseTechnicalSnapshotAction,stopTechnicalSnapshotAction} from './actions';
import TechnicalAutoRefresh from './TechnicalAutoRefresh';
import styles from './pikoquality.module.css';

const nf=n=>Number(n||0).toLocaleString('es-ES');
const pct=(n,total)=>total?Math.min(100,Math.round(Number(n||0)*1000/Number(total))/10):0;
const dt=v=>v?new Date(v).toLocaleString('es-ES'):'—';
const dur=ms=>{const s=Math.round(Number(ms||0)/1000);if(!s)return'—';const m=Math.floor(s/60),r=s%60;return m?`${m}m ${r}s`:`${r}s`};
const stateLabel={running:'Ejecutándose',completed:'Completado',error:'Error',stopped:'Detenido',paused:'Pausado'};

function Phase({number,title,active,done,progress,children}){
  return <div className={`${styles.syncProgress} ${active?styles.stepActive:''} ${done?styles.stepDone:''}`}>
    <div className={styles.syncProgressHead}><span><b>{number}</b> · {title}</span><b>{done?'✓':active?`${progress}%`:'Pendiente'}</b></div>
    <div className={styles.progressTrack}><span style={{width:`${done?100:progress}%`}}/></div>
    <small>{children}</small>
  </div>;
}

export default function TechnicalRunFlow({technical}){
  const c=technical.control||{};
  const run=technical.currentRun;
  const runs=technical.runs||[];
  const isRunning=run?.status==='running'&&c.actual_state==='running';
  const scanDone=run&&['capture','completed'].includes(run.phase);
  const captureDone=run?.phase==='completed';
  const libraryTotal=Number(technical.total.total||run?.scan_total||0);
  const scanProgress=run?pct(run.scan_total,libraryTotal):0;
  const captureProgress=run?.capture_planned?pct(run.capture_ok+run.capture_failed,run.capture_planned):(scanDone?100:0);
  const requested=c.requested_state||'stopped';
  const canStart=requested!=='running';
  const changed=Number(run?.scan_changed||0),created=Number(run?.scan_created||0);

  return <section className={styles.syncPanel}>
    <TechnicalAutoRefresh active={requested==='running'||isRunning}/>
    <div className={styles.syncHeader}>
      <div><span className={styles.kicker}>CAPTURA TÉCNICA · FLUJO DE EJECUCIÓN</span><h2>Comprobar → tratar únicamente cambios</h2><p>Cada ejecución queda registrada. Primero se compara la identidad física de toda la biblioteca; después solo se recapturan archivos nuevos o modificados.</p></div>
      <div className={`${styles.syncState} ${styles[`syncState_${c.actual_state}`]||''}`}><span>{technical.workerOnline?'●':'○'}</span>{stateLabel[c.actual_state]||c.actual_state||'En espera'}</div>
    </div>

    <div className={styles.syncProgressGrid}>
      <Phase number="1" title="Comprobación de biblioteca" active={isRunning&&run?.phase==='scan'} done={Boolean(scanDone)} progress={scanProgress}>
        {run?`${nf(run.scan_total)} revisados · ${nf(run.scan_created)} nuevos · ${nf(run.scan_changed)} modificados · ${Number(run.scan_items_per_second||0).toLocaleString('es-ES',{maximumFractionDigits:1})} elem/s · ${dur(run.scan_elapsed_ms)}`:'Lista para comparar tamaño, duración, parte y ruta de cada archivo.'}
      </Phase>
      <Phase number="2" title="Captura técnica de cambios" active={isRunning&&run?.phase==='capture'} done={Boolean(captureDone)} progress={captureProgress}>
        {run?`${nf(run.capture_planned)} a tratar · ${nf(run.capture_ok)} OK · ${nf(run.capture_failed)} errores · ${dur(run.capture_elapsed_ms)}`:'Solo se ejecuta para los casos detectados en la Fase 1.'}
      </Phase>
    </div>

    {run?<div className={styles.syncSummary}>
      <div><span>Ejecución</span><strong>#{run.id}</strong><small>{dt(run.started_at)}</small></div>
      <div><span>Resultado Fase 1</span><strong>{nf(created+changed)} cambios</strong><small>{nf(created)} nuevos · {nf(changed)} modificados</small></div>
      <div><span>Resultado Fase 2</span><strong>{nf(run.capture_ok)} / {nf(run.capture_planned)}</strong><small>{nf(run.capture_failed)} errores</small></div>
      <div><span>Estado</span><strong>{stateLabel[run.status]||run.status}</strong><small>{run.completed_at?`Fin: ${dt(run.completed_at)}`:`Fase: ${run.phase}`}</small></div>
    </div>:null}

    {c.last_error?<div className={styles.syncError}>Último error del worker: {c.last_error}</div>:null}
    <div className={styles.syncActions}>
      {canStart?<form action={startTechnicalSnapshotAction}><button className={styles.primaryButton}>{c.actual_state==='paused'?'Reanudar':'Iniciar nueva comprobación'}</button></form>:null}
      {requested==='running'?<form action={pauseTechnicalSnapshotAction}><button className={styles.secondaryButton}>Pausar</button></form>:null}
      {requested!=='stopped'?<form action={stopTechnicalSnapshotAction}><button className={styles.secondaryButton}>Detener</button></form>:null}
      <div className={styles.syncActionNote}>Una nueva ejecución siempre empieza por la Fase 1. Si no cambió ningún archivo, la Fase 2 terminará con 0 elementos a tratar.</div>
    </div>

    {runs.length?<div className={styles.tableWrap}><table className={styles.table}><thead><tr><th>Ejecución</th><th>Comprobados</th><th>Nuevos / modificados</th><th>Tratados</th><th>Errores</th><th>Duración</th><th>Estado</th></tr></thead><tbody>{runs.slice(0,6).map(r=><tr key={r.id}><td><b>#{r.id}</b><br/><span className={styles.muted}>{dt(r.started_at)}</span></td><td>{nf(r.scan_total)}</td><td>{nf(r.scan_created)} / {nf(r.scan_changed)}</td><td>{nf(r.capture_ok)} / {nf(r.capture_planned)}</td><td>{nf(r.capture_failed)}</td><td>{dur(Number(r.scan_elapsed_ms||0)+Number(r.capture_elapsed_ms||0))}</td><td>{stateLabel[r.status]||r.status}</td></tr>)}</tbody></table></div>:null}
  </section>;
}
