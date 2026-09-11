'use client';
import {useState,useTransition} from 'react';
import {useRouter} from 'next/navigation';
import {pauseTechnicalSnapshotAction,stopTechnicalSnapshotAction} from '@/app/calidad/pikoquality/actions';
import {startTechnicalSnapshotFromOperationsAction} from './actions';
import styles from './pikoquality-ops.module.css';

export default function TechnicalControlActions({requestedState='stopped',workerOnline=false,hasActiveRun=false}){
  const router=useRouter();
  const[pending,startTransition]=useTransition();
  const[feedback,setFeedback]=useState(null);
  const run=(action,success)=>startTransition(async()=>{
    setFeedback(null);
    try{
      await action();
      setFeedback({ok:true,message:success});
      router.refresh();
    }catch(error){
      setFeedback({ok:false,message:error?.message||'No se pudo ejecutar la acción'});
    }
  });
  const running=requestedState==='running';
  const paused=requestedState==='paused';
  return <>
    <div className={styles.actions}>
      {!running&&<button className={styles.actionButton} disabled={pending||!workerOnline} onClick={()=>run(startTechnicalSnapshotFromOperationsAction,paused?'Captura reanudada':'Nueva comprobación solicitada')}>{pending?'Procesando…':paused?'Reanudar captura':'Iniciar nueva comprobación'}</button>}
      {running&&<button className={styles.secondaryButton} disabled={pending} onClick={()=>run(pauseTechnicalSnapshotAction,'Captura pausada')}>{pending?'Procesando…':'Pausar'}</button>}
      {(running||paused||hasActiveRun)&&<button className={styles.secondaryButton} disabled={pending} onClick={()=>run(stopTechnicalSnapshotAction,'Ejecución detenida y conservada en Operaciones')}>{pending?'Procesando…':'Detener'}</button>}
    </div>
    {!workerOnline&&!running&&<div className={`${styles.feedback} ${styles.error}`}>El worker técnico no está disponible ahora; no se permite iniciar una ejecución que quedaría atascada.</div>}
    {feedback&&<div className={`${styles.feedback} ${feedback.ok?styles.ok:styles.error}`}>{feedback.message}</div>}
  </>;
}
