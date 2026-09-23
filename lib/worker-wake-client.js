import 'server-only';
import {buildWorkerWakeAuth} from './worker-wake-auth.mjs';

const URLS={
  api:process.env.PIKOFILM_WORKER_API_WAKE_URL||'https://pikofilm-worker-api-v3-production.up.railway.app/wake',
  fast:process.env.PIKOFILM_WORKER_FAST_WAKE_URL||'https://pikofilm-batch-fast-worker-v1-production.up.railway.app/wake',
  plex:process.env.PIKOFILM_WORKER_PLEX_WAKE_URL||'https://pikofilm-batch-plex-worker-v2-production.up.railway.app/wake',
  technical:process.env.PIKOFILM_WORKER_TECHNICAL_WAKE_URL||'https://pikofilm-technical-snapshot-worker-v1-production.up.railway.app/wake',
};
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));

export function workerWakeUrl(pool){return URLS[String(pool)]||null}

export async function wakeWorkerPool(pool,{reason='queued'}={}){
  const key=String(pool||''),url=workerWakeUrl(key),databaseUrl=process.env.DATABASE_URL||process.env.NEON_DATABASE_URL;
  if(!url||!databaseUrl)return{ok:false,skipped:true,reason:!url?'unknown_pool':'missing_database_url'};
  let lastError=null;
  for(const delay of [0,600,1800]){
    if(delay)await sleep(delay);
    const auth=buildWorkerWakeAuth(databaseUrl,key);
    const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),9000);
    try{
      const response=await fetch(url,{method:'POST',headers:{'content-type':'application/json','x-pikofilm-wake-ts':auth.timestamp,'x-pikofilm-wake-signature':auth.signature},body:JSON.stringify({reason:String(reason||'queued').slice(0,120)}),cache:'no-store',signal:controller.signal});
      clearTimeout(timer);
      if(response.ok)return{ok:true,status:response.status,pool:key};
      lastError=new Error(`Wake ${key} devolvió HTTP ${response.status}`);
    }catch(error){clearTimeout(timer);lastError=error}
  }
  console.error('[worker-wake] no se pudo despertar pool',key,String(lastError?.message||lastError));
  return{ok:false,pool:key,error:String(lastError?.message||lastError||'wake_failed')};
}
