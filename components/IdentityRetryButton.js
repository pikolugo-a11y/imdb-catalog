'use client';
import {useActionState,useEffect} from 'react';
import {usePathname,useRouter,useSearchParams} from 'next/navigation';
import {obtainIdentityAction} from '@/app/calidad/identidad/actions';
const initial={ok:null,status:'idle',message:''};
export default function IdentityRetryButton({imdbId,label='Obtener identidad',primary=false}){
  const[state,action,pending]=useActionState(obtainIdentityAction,initial),router=useRouter(),pathname=usePathname(),params=useSearchParams();
  useEffect(()=>{if(state?.ok===true){const q=new URLSearchParams(params.toString());q.set('notice','identity_resolved');q.set('message',state.message||'Identidad completada');router.replace(`${pathname}?${q.toString()}`,{scroll:false})}},[state?.ok,state?.message,pathname,params,router]);
  return <div className="identity-action-stack"><form action={action}><input type="hidden" name="imdbId" value={imdbId}/><button className={primary?'identity-action-primary':'button ghost'} disabled={pending}>{pending?'Obteniendo…':state?.status==='error'?'Reintentar':label}</button></form>{state?.message&&state.ok!==true&&<small className={`identity-inline-result ${state.status||'error'}`}>{state.message}</small>}</div>
}
