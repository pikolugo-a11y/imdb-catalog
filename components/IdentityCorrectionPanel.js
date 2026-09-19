'use client';
import {useActionState,useEffect,useState} from 'react';
import {usePathname,useRouter,useSearchParams} from 'next/navigation';
import {saveIdentityPageAction} from '@/app/calidad/identidad/actions';
const initial={ok:null,status:'idle',message:''};
const isSeriesType=value=>value==='Serie'||value==='Miniserie';
export default function IdentityCorrectionPanel({imdbId,tmdbId='',title,type='',identityMode=''}){
  const[state,action,pending]=useActionState(saveIdentityPageAction,initial),[open,setOpen]=useState(false),[changeImdb,setChangeImdb]=useState(false),[nextType,setNextType]=useState(type||'Película'),[tmdbOnly,setTmdbOnly]=useState(isSeriesType(type)&&identityMode==='tmdb_only'),router=useRouter(),pathname=usePathname(),params=useSearchParams();
  const canUseTmdbOnly=isSeriesType(nextType);
  useEffect(()=>{if(!canUseTmdbOnly&&tmdbOnly)setTmdbOnly(false)},[canUseTmdbOnly,tmdbOnly]);
  useEffect(()=>{if(state?.ok===true){setOpen(false);const q=new URLSearchParams(params.toString());q.set('notice','identity_saved');q.set('message',state.message||'Identidad guardada');router.replace(`${pathname}?${q.toString()}`,{scroll:false})}},[state?.ok,state?.message,pathname,params,router]);
  if(!open)return <button type="button" className="button ghost" onClick={()=>setOpen(true)}>Corregir</button>;
  return <div className="identity-correction" data-identity-edit-open="true">
    <div className="identity-correction-head"><div><strong>Corregir identidad</strong><small>{title}</small></div><button type="button" className="identity-close" onClick={()=>setOpen(false)}>×</button></div>
    <form action={action} onSubmit={e=>{const fd=new FormData(e.currentTarget),next=String(fd.get('newImdbId')||''),selectedType=String(fd.get('newType')||type);if(selectedType!==type&&!window.confirm(`Vas a cambiar el tipo de “${title}” de ${type} a ${selectedType}. ¿Confirmas el cambio?`)){e.preventDefault();return}if(!tmdbOnly&&next!==imdbId&&!window.confirm('Vas a cambiar el identificador IMDb principal de este título. ¿Confirmas el cambio?'))e.preventDefault();}}>
      <input type="hidden" name="imdbId" value={imdbId}/>
      <input type="hidden" name="tmdbOnly" value={tmdbOnly?'1':'0'}/>
      <label>Tipo<select name="newType" value={nextType} onChange={e=>setNextType(e.target.value)}><option value="Película">Película</option><option value="Serie">Serie</option><option value="Miniserie">Miniserie</option></select></label>
      {canUseTmdbOnly&&<fieldset className="identity-mode"><legend>Modo de identidad</legend><label><input type="radio" name="identityModeUi" checked={!tmdbOnly} onChange={()=>setTmdbOnly(false)}/> Normal · IMDb + TMDb</label><label><input type="radio" name="identityModeUi" checked={tmdbOnly} onChange={()=>{setTmdbOnly(true);setChangeImdb(false)}}/> TMDb solo</label>{tmdbOnly&&<small>Esta serie usará TMDb como fuente canónica de identidad y metadatos. El identificador interno se conserva, pero IMDb deja de utilizarse como fuente.</small>}</fieldset>}
      {!tmdbOnly&&<label>IMDb
        <div className="identity-input-row"><input name="newImdbId" defaultValue={imdbId} readOnly={!changeImdb} pattern="tt[0-9]+" required/><button type="button" className="button ghost" onClick={()=>setChangeImdb(v=>!v)}>{changeImdb?'Bloquear':'Cambiar IMDb'}</button></div>
      </label>}
      {tmdbOnly&&<input type="hidden" name="newImdbId" value={imdbId}/>}
      <label>TMDb<input name="tmdbId" defaultValue={tmdbId} inputMode="numeric" pattern="[0-9]+" placeholder="ID numérico" required={tmdbOnly}/></label>
      {state?.message&&state.ok!==true&&<div className={`identity-form-result ${state.status||'error'}`}>{state.message}</div>}
      <div className="identity-correction-actions"><button type="button" className="button ghost" onClick={()=>setOpen(false)}>Cancelar</button><button disabled={pending}>{pending?'Validando…':'Guardar identidad'}</button></div>
    </form>
  </div>;
}
