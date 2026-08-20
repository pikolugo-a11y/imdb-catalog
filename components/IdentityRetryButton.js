'use client';
import {useActionState} from 'react';
import {retryMissingIdentityAction} from '@/app/calidad/identidad/actions';
const initial={ok:null,message:''};
export default function IdentityRetryButton({imdbId}){const[state,action,pending]=useActionState(retryMissingIdentityAction,initial);return <div className="process-title-action"><form action={action}><input type="hidden" name="imdbId" value={imdbId}/><button className="button ghost" disabled={pending}>{pending?'Buscando…':'↻ Reintentar búsqueda'}</button></form>{state?.message&&<small className={state.ok?'process-result ok':'process-result error'}>{state.message}</small>}</div>}
