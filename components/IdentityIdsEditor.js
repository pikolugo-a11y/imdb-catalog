'use client';
import {useActionState} from 'react';

export default function IdentityIdsEditor({action,forceAction,imdbId,tmdbId,returnTo}){
  const[state,formAction,pending]=useActionState(action,null);
  const[forceState,forceFormAction,forcePending]=useActionState(forceAction,null);
  const mismatch=state?.status==='mismatch';
  const attemptedImdb=state?.attemptedImdbId||imdbId;
  const attemptedTmdb=state?.attemptedTmdbId||'';
  return <div className="iv-edit-stack">
    <form action={formAction} className="iv-edit">
      <input type="hidden" name="imdbId" value={imdbId}/>
      <input type="hidden" name="returnTo" value={returnTo}/>
      <label>IMDb actual <small>{imdbId}</small><input name="newImdbId" defaultValue={imdbId}/></label>
      <label>TMDb actual <small>{tmdbId||'—'}</small><input name="tmdbId" defaultValue={tmdbId||''}/></label>
      <button disabled={pending}>{pending?'Comprobando…':'Guardar y comprobar'}</button>
      {state?.message?<small className={state.ok?'action-ok':'action-error'} role="status">{state.message}</small>:null}
    </form>
    {mismatch&&forceAction?<form action={forceFormAction} className="iv-edit iv-force">
      <input type="hidden" name="imdbId" value={imdbId}/>
      <input type="hidden" name="newImdbId" value={attemptedImdb}/>
      <input type="hidden" name="tmdbId" value={attemptedTmdb}/>
      <input type="hidden" name="returnTo" value={returnTo}/>
      <strong>Forzar asociación manual</strong>
      <small>PikoFilm ha comprobado que TMDb {attemptedTmdb} pertenece a otro IMDb. Solo continúa si quieres conservar esta asociación igualmente.</small>
      <label>Confirmación <input name="forceConfirmation" placeholder="Escribe FORZAR" autoComplete="off"/></label>
      <button className="manual-bad" disabled={forcePending}>{forcePending?'Forzando…':'Forzar asociación'}</button>
      {forceState?.message?<small className={forceState.ok?'action-ok':'action-error'} role="status">{forceState.message}</small>:null}
    </form>:null}
  </div>;
}
