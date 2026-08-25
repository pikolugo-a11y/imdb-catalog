'use client';
import {useActionState,useEffect,useState} from 'react';
import {usePathname,useRouter,useSearchParams} from 'next/navigation';
import {saveIdentityPageAction} from '@/app/calidad/identidad/actions';
const initial={ok:null,status:'idle',message:''};
export default function IdentityCorrectionPanel({imdbId,tmdbId='',title}){
  const[state,action,pending]=useActionState(saveIdentityPageAction,initial),[open,setOpen]=useState(false),[changeImdb,setChangeImdb]=useState(false),router=useRouter(),pathname=usePathname(),params=useSearchParams();
  useEffect(()=>{if(state?.ok===true){setOpen(false);const q=new URLSearchParams(params.toString());q.set('notice','identity_saved');q.set('message',state.message||'Identidad guardada');router.replace(`${pathname}?${q.toString()}`,{scroll:false})}},[state?.ok,state?.message,pathname,params,router]);
  if(!open)return <button type="button" className="button ghost" onClick={()=>setOpen(true)}>Corregir</button>;
  return <div className="identity-correction" data-identity-edit-open="true">
    <div className="identity-correction-head"><div><strong>Corregir identidad</strong><small>{title}</small></div><button type="button" className="identity-close" onClick={()=>setOpen(false)}>×</button></div>
    <form action={action} onSubmit={e=>{const fd=new FormData(e.currentTarget);const next=String(fd.get('newImdbId')||'');if(next!==imdbId&&!window.confirm('Vas a cambiar el identificador IMDb principal de este título. ¿Confirmas el cambio?'))e.preventDefault();}}>
      <input type="hidden" name="imdbId" value={imdbId}/>
      <label>IMDb
        <div className="identity-input-row"><input name="newImdbId" defaultValue={imdbId} readOnly={!changeImdb} pattern="tt[0-9]+" required/><button type="button" className="button ghost" onClick={()=>setChangeImdb(v=>!v)}>{changeImdb?'Bloquear':'Cambiar IMDb'}</button></div>
      </label>
      <label>TMDb<input name="tmdbId" defaultValue={tmdbId} inputMode="numeric" pattern="[0-9]*" placeholder="ID numérico"/></label>
      {state?.message&&state.ok!==true&&<div className={`identity-form-result ${state.status||'error'}`}>{state.message}</div>}
      <div className="identity-correction-actions"><button type="button" className="button ghost" onClick={()=>setOpen(false)}>Cancelar</button><button disabled={pending}>{pending?'Validando…':'Guardar identidad'}</button></div>
    </form>
  </div>;
}
