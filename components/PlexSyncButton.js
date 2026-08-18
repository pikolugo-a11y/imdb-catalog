'use client';
import {useActionState} from 'react';
import {syncPlex} from '@/app/actions';

const initialState={ok:null,message:''};

export default function PlexSyncButton(){
  const[state,formAction,pending]=useActionState(syncPlex,initialState);
  return <div className="process-title-action">
    <form action={formAction}><button disabled={pending}>{pending?'Actualizando Plex…':'Actualizar Plex'}</button></form>
    {state?.message&&<small className={state.ok?'process-result ok':'process-result error'}>{state.message}</small>}
  </div>
}
