import 'server-only';
import {audit} from './runlog';

function sanitizeUrl(url){try{const u=new URL(url);for(const key of ['apikey','api_key','key','token','access_token'])if(u.searchParams.has(key))u.searchParams.set(key,'***');return u.toString();}catch{return String(url||'');}}

export async function loggedJsonFetch({imdbId,source,url,options={}}){
  const started=Date.now(),safeUrl=sanitizeUrl(url);let response;
  try{response=await fetch(url,{...options,cache:'no-store'});}catch(e){await audit('data_quality','title',imdbId,'provider_http_transport_error',{source,url:safeUrl,message:e?.message||String(e),duration_ms:Date.now()-started});throw e;}
  const text=await response.text();let body;
  try{body=text?JSON.parse(text):null;}catch{body=text;}
  if(!response.ok)await audit('data_quality','title',imdbId,'provider_http_error',{source,url:safeUrl,status:response.status,duration_ms:Date.now()-started,message:typeof body==='string'?body.slice(0,500):body?.status_message||body?.Error||null});
  return{response,body,text};
}
