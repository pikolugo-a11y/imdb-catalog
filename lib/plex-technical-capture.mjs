import {discoverPlexUrlCore} from './plex-sync-core.mjs';
import {persistTechnicalSnapshot,markTechnicalCaptureError} from './plex-technical-store.mjs';

const CLIENT='pikofilm-technical-snapshot';
const headers=token=>({'Accept':'application/json','X-Plex-Token':token,'X-Plex-Client-Identifier':CLIENT,'X-Plex-Product':'PikoFilm','X-Plex-Version':'2'});
const list=body=>body?.MediaContainer?.Metadata||body?.MediaContainer?.Video||[];

export async function fetchTechnicalItem({token,baseUrl='',ratingKey}){
  if(!token)throw new Error('PLEX_TOKEN no está configurado');
  const key=String(ratingKey||'').trim();
  if(!key)throw new Error('ratingKey requerido');
  const base=await discoverPlexUrlCore(token,baseUrl);
  const path=`/library/metadata/${encodeURIComponent(key)}?includeGuids=1&includeMedia=1`;
  const response=await fetch(base+path,{headers:headers(token),cache:'no-store',signal:AbortSignal.timeout(120000)});
  if(!response.ok)throw new Error(`Plex ${path} respondió ${response.status}`);
  const item=list(await response.json())[0];
  if(!item)throw new Error(`Plex no devolvió detalle para ${key}`);
  if(!item.ratingKey)item.ratingKey=key;
  return item;
}

export async function captureTechnicalRatingKey(sql,{token,baseUrl='',ratingKey}){
  try{
    const item=await fetchTechnicalItem({token,baseUrl,ratingKey});
    const result=await persistTechnicalSnapshot(sql,item);
    if(result.stream_count===0)throw new Error(`Snapshot técnico ${ratingKey} sin streams`);
    return result;
  }catch(error){
    await markTechnicalCaptureError(sql,ratingKey,error).catch(()=>{});
    throw error;
  }
}
