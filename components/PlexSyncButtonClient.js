'use client';
import {useActionState} from 'react';
import {syncPlexFromNews} from '@/app/novedades/plex-actions';
const initialState={ok:null,message:''};
export default function PlexSyncButtonClient({defaultReviewFrom=''}){const[state,formAction,pending]=useActionState(syncPlexFromNews,initialState);return <div className="process-title-action"><form action={formAction} style={{display:'flex',gap:8,alignItems:'end',flexWrap:'wrap'}}><label style={{display:'grid',gap:3,fontSize:12}}><span>Revisar cambios Plex desde</span><input type="date" name="reviewFrom" defaultValue={defaultReviewFrom} disabled={pending}/></label><button disabled={pending}>{pending?'Actualizando Plex…':'Actualizar Plex'}</button></form>{state?.message&&<small className={state.ok?'process-result ok':'process-result error'}>{state.message}</small>}</div>}
