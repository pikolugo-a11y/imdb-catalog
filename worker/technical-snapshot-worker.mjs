import {neon} from '@neondatabase/serverless';
import {scanPlexTechnicalLibrary} from '../lib/plex-technical-scan.mjs';
import {claimTechnicalBatch} from '../lib/plex-technical-queue.mjs';
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
const scanEveryMs=Math.max(60000,Number(process.env.TECHNICAL_SNAPSHOT_SCAN_MS)||900000);
const once=String(process.env.TECHNICAL_SNAPSHOT_ONCE||'').toLowerCase()==='true';
const requestedItemType=String(process.env.TECHNICAL_SNAPSHOT_ITEM_TYPE||'').trim().toLowerCase();
const itemType=['movie','episode'].includes(requestedItemType)?requestedItemType:null;

const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
let lastScanAt=0;

async function processChunk(rows){
  let ok=0,failed=0;
  for(let pos=0;pos<rows.length;pos+=concurrency){
    const chunk=rows.slice(pos,pos+concurrency);
    const results=await Promise.allSettled(chunk.map(row=>captureTechnicalRatingKey(sql,{token,baseUrl,ratingKey:row.rating_key})));
    for(const result of results){if(result.status==='fulfilled')ok++;else failed++;}
  }
  return{ok,failed};
}

async function maybeScan(force=false){
  const now=Date.now();
  if(!force&&now-lastScanAt<scanEveryMs)return null;
  const result=await scanPlexTechnicalLibrary({sql,token,baseUrl});
  lastScanAt=Date.now();
  return result;
}

async function cycle(){
  const scan=await maybeScan(lastScanAt===0);
  const rows=await claimTechnicalBatch(sql,{limit:batchSize,itemType});
  if(!rows.length)return{scan,item_type:itemType,claimed:0,ok:0,failed:0};
  const result=await processChunk(rows);
  return{scan,item_type:itemType,claimed:rows.length,...result};
}

console.log(`[technical-snapshot-worker] started batch=${batchSize} concurrency=${concurrency} scanEveryMs=${scanEveryMs} once=${once} itemType=${itemType||'any'}`);
for(;;){
  const started=Date.now();
  try{
    const result=await cycle();
    console.log('[technical-snapshot-worker]',JSON.stringify({...result,elapsed_ms:Date.now()-started}));
    if(once)break;
    if(result.claimed===0)await sleep(Math.min(idleMs,scanEveryMs));
  }catch(error){
    console.error('[technical-snapshot-worker] cycle failed',error);
    if(once)process.exitCode=1;
    if(once)break;
    await sleep(idleMs);
  }
}
