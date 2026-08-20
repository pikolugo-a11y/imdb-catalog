'use client';
import {useActionState} from 'react';
import {refreshIdentityDataAction} from '@/app/calidad/identidad/actions';
const initial={ok:null,message:''};
export default function IdentityRefreshButton({imdbId,label='↻ Refrescar datos'}){const[state,action,pending]=useActionState(refreshIdentityDataAction,initial);return <div className="process-title-action"><form action={action}><input type="hidden" name="imdbId" value={imdbId}/><button className="button primary" disabled={pending}>{pending?'Refrescando…':label}</button></form>{state?.message&&<small className={state.ok?'process-result ok':'process-result error'}>{state.message}</small>}</div>}
