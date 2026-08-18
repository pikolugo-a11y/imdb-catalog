'use client';
import {useActionState} from 'react';
import {processTitle} from '@/app/actions';

const initialState={ok:null,message:''};

export default function EnrichTitleButton({imdbId,label='Procesar',className=''}){
  const[state,formAction,pending]=useActionState(processTitle,initialState);
  return <div className="process-title-action">
    <form action={formAction}>
      <input type="hidden" name="imdbId" value={imdbId}/>
      <button className={className} disabled={pending}>{pending?'Procesando…':label}</button>
    </form>
    {state?.message&&<small className={state.ok?'process-result ok':'process-result error'}>{state.message}</small>}
  </div>
}
