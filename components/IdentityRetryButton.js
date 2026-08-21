'use client';
import {useActionState,useEffect,useState} from 'react';
import {useRouter} from 'next/navigation';
import {obtainIdentityAction} from '@/app/calidad/identidad/actions';
const initial={ok:null,message:'',runId:null};
export default function IdentityRetryButton({imdbId}){
  const[state,action,pending]=useActionState(obtainIdentityAction,initial),[result,setResult]=useState(null),router=useRouter();
  useEffect(()=>{
    if(!state?.runId)return;
    let stopped=false,timer;
    const poll=async()=>{try{const r=await fetch(`/api/identity/run/${state.runId}`,{cache:'no-store'}),j=await r.json();if(stopped)return;if(j.done){setResult(j);router.refresh();return}timer=setTimeout(poll,1500)}catch{if(!stopped)timer=setTimeout(poll,2500)}};
    poll();return()=>{stopped=true;if(timer)clearTimeout(timer)};
  },[state?.runId,router]);
  const working=pending||Boolean(state?.runId&&!result?.done),msg=result?.message||state?.message;
  return <div className="process-title-action"><form action={action}><input type="hidden" name="imdbId" value={imdbId}/><button className="button ghost" disabled={working}>{working?'Obteniendo identidad…':'Obtener identidad'}</button></form>{msg&&<small className={(result?.ok??state?.ok)?'process-result ok':'process-result error'}>{msg}</small>}{result?.nextUrl&&<a className="process-result ok" href={result.nextUrl}>Ir al siguiente paso →</a>}</div>
}
