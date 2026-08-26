import 'server-only';
import {audit} from './runlog';

function sanitizeUrl(url){try{const u=new URL(url);for(const key of ['apikey','api_key','key','token','access_token'])if(u.searchParams.has(key))u.searchParams.set(key,'***');return u.toString();}catch{return String(url||'');}}
function summarizeHeaders(headers){const out={};for(const [k,v] of Object.entries(headers||{})){const key=String(k).toLowerCase();out[k]=key==='authorization'||key.includes('key')?'***':v;}return out;}

export async function loggedJsonFetch({imdbId,source,url,options={}}){
  const started=Date.now(),safeUrl=sanitizeUrl(url),safeHeaders=summarizeHeaders(options.headers||{});
  await audit('data_quality','title',imdbId,'provider_http_request',{source,method:options.method||'GET',url:safeUrl,headers:safeHeaders});
  let response;
  try{response=await fetch(url,{...options,cache:'no-store'});}catch(e){await audit('data_quality','title',imdbId,'provider_http_transport_error',{source,url:safeUrl,message:e?.message||String(e),duration_ms:Date.now()-started});throw e;}
  const text=await response.text();let body;
  try{body=text?JSON.parse(text):null;}catch{body=text;}
  await audit('data_quality','title',imdbId,'provider_http_response',{source,url:safeUrl,status:response.status,ok:response.ok,duration_ms:Date.now()-started,body});
  return{response,body,text};
}
