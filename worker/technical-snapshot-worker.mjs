import {neon} from '@neondatabase/serverless';
import {refreshTechnicalQueue,claimTechnicalBatch} from '../lib/plex-technical-queue.mjs';
import {captureTechnicalRatingKey} from '../lib/plex-technical-capture.mjs';

const connectionString=process.env.DATABASE_URL||process.env.NEON_DATABASE_URL;
if(!connectionString)throw new Error('Falta DATABASE_URL/NEON_DATABASE_URL');
const token=process.env.PLEX_TOKEN;
if(!token)throw new Error('Falta PLEX_TOKEN');
const baseUrl=process.env.PLEX_URL||process.env.PLEX_BASE_URL||'';
const sql=neon(connectionString);
const batchSize=Math.max(1,Math.min(100,Number(process.env.TECHNICAL_SNAPSHOT_BATCH_SIZE)||25));
const concurrency=Math.max(1,Math.min(8,Number(process.env.TECHNICAL_SNAPSHOT_CONCURRENCY)||4));
const idleMs=Math.max(5000,Number(process.env.TECHNICAL_SNAPSHOT_IDLE_MS)||30000);
const once=String(process.env.TECHNICAL_SNAPSHOT_ONCE||'').toLowerCase()==='true';

const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));

async function processChunk(rows){
  let ok=0,failed=0;
  for(let pos=0;pos<rows.length;pos+=concurrency){
    const chunk=rows.slice(pos,pos+concurrency);
    const results=await Promise.allSettled(chunk.map(row=>captureTechnicalRatingKey(sql,{token,baseUrl,ratingKey:row.rating_key})));
    for(const result of results){if(result.status==='fulfilled')ok++;else failed++;}
  }
  return{ok,failed};
}

async function cycle(){
  const queue=await refreshTechnicalQueue(sql);
  const rows=await claimTechnicalBatch(sql,{limit:batchSize});
  if(!rows.length)return{...queue,claimed:0,ok:0,failed:0};
  const result=await processChunk(rows);
  return{...queue,claimed:rows.length,...result};
}

console.log(`[technical-snapshot-worker] started batch=${batchSize} concurrency=${concurrency} once=${once}`);
for(;;){
  const started=Date.now();
  try{
    const result=await cycle();
    console.log('[technical-snapshot-worker]',JSON.stringify({...result,elapsed_ms:Date.now()-started}));
    if(once)break;
    if(result.claimed===0)await sleep(idleMs);
  }catch(error){
    console.error('[technical-snapshot-worker] cycle failed',error);
    if(once)process.exitCode=1;
    if(once)break;
    await sleep(idleMs);
  }
}
