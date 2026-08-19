'use client';

import {useRef,useState} from 'react';
import {useRouter} from 'next/navigation';
import styles from './pikoquality.module.css';

const nf=n=>Number(n||0).toLocaleString('es-ES');

export default function PikoQualityRunner({initial}){
  const router=useRouter();
  const [state,setState]=useState(initial);
  const [running,setRunning]=useState(false);
  const [message,setMessage]=useState('');
  const [error,setError]=useState('');
  const stopRef=useRef(false);

  const phase=state?.recommendation?.phase||'done';
  const canRun=phase!=='done';

  async function oneBatch(currentPhase){
    const r=await fetch('/api/pikoquality/run',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({phase:currentPhase})});
    const data=await r.json();
    if(!r.ok||!data.ok)throw new Error(data.error||'Error ejecutando PikoQuality');
    setState(data.state);
    const x=data.result||{};
    if(currentPhase==='a')setMessage(`Lote A completado: ${nf(x.processed)} procesados. Quedan ${nf(data.state.pending_a)}.`);
    else if(currentPhase==='b'||currentPhase==='retry_b')setMessage(`Lote B completado: ${nf(x.enriched)} enriquecidos, ${nf(x.stale)} stale y ${nf(x.errors)} errores. Quedan ${nf(data.state.pending_b)}.`);
    else if(currentPhase==='aggregate')setMessage(`Agregados actualizados: ${nf(x.seasons)} temporadas y ${nf(x.shows)} series.`);
    return data.state;
  }

  async function runRecommended(){
    if(!canRun||running)return;
    setRunning(true);setError('');setMessage('');stopRef.current=false;
    const startPhase=phase;
    try{
      let current=state;
      while(!stopRef.current){
        current=await oneBatch(startPhase);
        const stillSame=current?.recommendation?.phase===startPhase;
        if(!stillSame)break;
      }
      router.refresh();
    }catch(e){setError(String(e?.message||e));}
    finally{setRunning(false);stopRef.current=false;}
  }
  function pause(){stopRef.current=true;setMessage('Pausa solicitada. El lote actual terminará y después se detendrá.');}

  const progress=phase==='a'?state.progressA:phase==='b'||phase==='retry_b'?state.progressB:100;
  const done=phase==='done';
  return <div className={styles.actionCard}>
    <div className={styles.actionCopy}>
      <span className={styles.kicker}>Siguiente acción recomendada</span>
      <h2>{state.recommendation.label}</h2>
      <p>{state.recommendation.description}</p>
      {!done&&<div className={styles.progressWrap}><div className={styles.progressTrack}><span style={{width:`${Math.max(2,progress)}%`}}/></div><b>{progress}%</b></div>}
      {message&&<div className={styles.notice}>{message}</div>}
      {error&&<div className={styles.error}>{error}</div>}
    </div>
    <div className={styles.actionButtons}>
      {!done&&!running&&<button className={styles.primaryButton} onClick={runRecommended}>▶ {state.recommendation.label}</button>}
      {running&&<><button className={styles.primaryButton} disabled>Procesando…</button><button className={styles.secondaryButton} onClick={pause}>Pausar tras este lote</button></>}
      {done&&<div className={styles.allGood}>✓ Todo al día</div>}
      <small>{running?'Puedes dejar esta pestaña abierta. El proceso avanza por lotes y cada lote queda registrado en Admin.':'Puedes cerrar la pestaña en cualquier momento y continuar después sin perder progreso.'}</small>
    </div>
  </div>;
}
