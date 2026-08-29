'use client';
import {useActionState} from 'react';

export default function IdentityIdsEditor({action,imdbId,tmdbId,returnTo}){
  const[state,formAction,pending]=useActionState(action,null);
  return <form action={formAction} className="iv-edit">
    <input type="hidden" name="imdbId" value={imdbId}/>
    <input type="hidden" name="returnTo" value={returnTo}/>
    <label>IMDb actual <small>{imdbId}</small><input name="newImdbId" defaultValue={imdbId}/></label>
    <label>TMDb actual <small>{tmdbId||'—'}</small><input name="tmdbId" defaultValue={tmdbId||''}/></label>
    <button disabled={pending}>{pending?'Comprobando…':'Guardar y comprobar'}</button>
    {state?.message?<small className={state.ok?'action-ok':'action-error'} role="status">{state.message}</small>:null}
  </form>;
}
