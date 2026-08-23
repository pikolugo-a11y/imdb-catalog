'use client';
import {useActionState,useEffect} from 'react';
import {useRouter} from 'next/navigation';
import {obtainIdentityAction} from '@/app/calidad/identidad/actions';
const initial={ok:null,message:''};
export default function IdentityRetryButton({imdbId}){
  const[state,action,pending]=useActionState(obtainIdentityAction,initial),router=useRouter();
  useEffect(()=>{if(state?.ok===true)router.refresh()},[state?.ok,router]);
  return <div className="process-title-action"><form action={action}><input type="hidden" name="imdbId" value={imdbId}/><button className="button ghost" disabled={pending}>{pending?'Obteniendo identidad…':'Obtener identidad'}</button></form>{state?.message&&<small className={state.ok?'process-result ok':'process-result error'}>{state.message}</small>}</div>
}
