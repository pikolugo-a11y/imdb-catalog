'use client';
import {useActionState,useEffect} from 'react';
import {useRouter} from 'next/navigation';
import {syncPlexFromNews} from '@/app/novedades/plex-actions';
const initialState={ok:null,message:'',runId:null};
export default function PlexSyncButtonClient({defaultReviewFrom='',initiallyRunning=false,activeProcess=null}){
  const[state,formAction,pending]=useActionState(syncPlexFromNews,initialState);
  const router=useRouter();
  const busy=initiallyRunning||pending;
  useEffect(()=>{if(state?.runId)router.refresh()},[state?.runId,router]);
  useEffect(()=>{
    if(!initiallyRunning)return;
    const refresh=()=>{if(typeof document==='undefined'||document.visibilityState==='visible')router.refresh()};
    const timer=setInterval(refresh,10000);
    return()=>clearInterval(timer);
  },[initiallyRunning,router]);
  const runningLabel=activeProcess==='PROC-NOV-008'?'Preparando Novedades…':'Actualizando Plex…';
  const buttonLabel=pending?'Encolando Plex…':initiallyRunning?runningLabel:'Actualizar Plex';
  return <div className="process-title-action"><form action={formAction} style={{display:'flex',gap:8,alignItems:'end',flexWrap:'wrap'}}><label style={{display:'grid',gap:3,fontSize:12}}><span>Revisar cambios Plex desde</span><input type="date" name="reviewFrom" defaultValue={defaultReviewFrom} disabled={busy}/></label><button disabled={busy}>{buttonLabel}</button></form>{state?.message&&<small className={state.ok?'process-result ok':'process-result error'}>{state.message}</small>}</div>
}
