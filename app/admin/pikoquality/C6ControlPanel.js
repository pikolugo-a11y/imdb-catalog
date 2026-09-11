'use client';
import {useState} from 'react';
import {useRouter} from 'next/navigation';
import {startC6BatchRunAction,runC6BatchChunkAction} from '@/app/calidad/pikoquality/actions';
import styles from './pikoquality-ops.module.css';

const nf=n=>Number(n||0).toLocaleString('es-ES');
const pct=(n,d)=>d?Math.round(Number(n||0)*1000/Number(d))/10:0;
const fmtMs=ms=>{const s=Math.max(0,Number(ms||0))/1000;return s<60?`${s.toFixed(1)} s`:`${Math.floor(s/60)}m ${Math.round(s%60)}s`};

export default function C6ControlPanel({initial,capturePending=0}){
  const router=useRouter();
  const[running,setRunning]=useState(false);
  const[current,setCurrent]=useState(Number(initial.current||0));
  const[remaining,setRemaining]=useState(Number(initial.pending||0));
  const[processed,setProcessed]=useState(0);
  const[speed,setSpeed]=useState(0);
  const[elapsed,setElapsed]=useState(0);
  const[error,setError]=useState('');
  const total=Number(initial.total||0),batchSize=Number(initial.batchSize||1000),progress=pct(current,total);

  async function runAll(){
    if(running||remaining<=0)return;
    setRunning(true);setError('');setProcessed(0);setSpeed(0);setElapsed(0);
    const started=performance.now();let left=remaining,done=0;
    try{
      const start=await startC6BatchRunAction();
      const id=start?.runId||null;
      left=Number(start?.pending??left);setRemaining(left);
      if(left<=0){setCurrent(total);router.refresh();return;}
      if(!id)throw new Error('No se pudo iniciar la ejecución C6');
      while(left>0){
        const r=await runC6BatchChunkAction(id);
        const chunk=Number(r.processed||0);done+=chunk;left=Number(r.remaining||0);
        const ms=performance.now()-started;
        setProcessed(done);setRemaining(left);setCurrent(total-left);setElapsed(ms);setSpeed(ms?Math.round(done/(ms/1000)):0);
        if(chunk===0&&left>0)throw new Error('C6 no avanzó. Revisa la ejecución en Operaciones antes de reintentar.');
      }
      router.refresh();
    }catch(e){setError(e?.message||'Error ejecutando PikoQuality C6');}
    finally{setRunning(false);}
  }

  return <section className="ops-panel">
    <div className="ops-panel-head"><div><span className="ops-label">Cálculo PikoQuality</span><h2>C6 sobre evidencia técnica disponible</h2><p>C6 no consulta Plex. Sólo puntúa archivos que ya tienen una captura técnica válida.</p></div><span className={`ops-count ${remaining>0?'warn':''}`}>{initial.version}</span></div>
    <div className={styles.progress}><span style={{width:`${Math.min(100,progress)}%`}}/></div>
    <div className={styles.c6Stats}>
      <div><span>Capturas calculables</span><strong>{nf(total)}</strong></div>
      <div><span>C6 vigente</span><strong className={remaining===0?styles.good:''}>{nf(current)}</strong></div>
      <div><span>Pendientes C6</span><strong className={remaining>0?styles.attention:styles.good}>{nf(remaining)}</strong></div>
    </div>
    {Number(capturePending)>0&&<div className={styles.notice}><b>{nf(capturePending)} archivo(s) están antes de C6:</b> todavía necesitan captura técnica y por eso no forman parte del denominador calculable.</div>}
    {running&&<div className={styles.notice}>Procesando esta ejecución: {nf(processed)} · {nf(speed)}/s · {fmtMs(elapsed)} · quedan {nf(remaining)}.</div>}
    {error&&<div className={`${styles.feedback} ${styles.error}`}>{error}</div>}
    <div className={styles.actions}><button className={styles.actionButton} onClick={runAll} disabled={running||remaining<=0}>{running?'Calculando C6…':remaining>0?'Calcular pendientes C6':'C6 al día sobre capturados'}</button></div>
    <div className={styles.links}><a href="/admin?process=PROC-PQ-001&period=30d">Ver ejecuciones C6 en Operaciones →</a></div>
    <small style={{display:'block',marginTop:8,color:'var(--muted)'}}>Bloques de hasta {nf(batchSize)}. Los errores y el historial viven en Operaciones.</small>
  </section>;
}
