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
const mode=String(process.env.TECHNICAL_SNAPSHOT_MODE||'incremental').trim().toLowerCase();
if(!['incremental','backfill'].includes(mode))throw new Error(`TECHNICAL_SNAPSHOT_MODE no soportado: ${mode}`);
const requestedItemType=String(process.env.TECHNICAL_SNAPSHOT_ITEM_TYPE||'').trim().toLowerCase();
const itemType=['movie','episode'].includes(requestedItemType)?requestedItemType:null;
const maxItemsRaw=Number(process.env.TECHNICAL_SNAPSHOT_MAX_ITEMS||0);
const maxItems=Number.isFinite(maxItemsRaw)&&maxItemsRaw>0?Math.floor(maxItemsRaw):0;

const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
let lastScanAt=0;
let totalClaimed=0,totalOk=0,totalFailed=0;

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
  if(mode==='backfill')return null;
  const now=Date.now();
  if(!force&&now-lastScanAt<scanEveryMs)return null;
  const result=await scanPlexTechnicalLibrary({sql,token,baseUrl});
  lastScanAt=Date.now();
  return result;
}

async function cycle(){
  const scan=await maybeScan(lastScanAt===0);
  const remainingAllowance=maxItems?Math.max(0,maxItems-totalClaimed):batchSize;
  if(maxItems&&remainingAllowance===0)return{scan,item_type:itemType,claimed:0,ok:0,failed:0,limit_reached:true};
  const limit=maxItems?Math.min(batchSize,remainingAllowance):batchSize;
  const rows=await claimTechnicalBatch(sql,{limit,itemType});
  if(!rows.length)return{scan,item_type:itemType,claimed:0,ok:0,failed:0,queue_empty:true};
  const result=await processChunk(rows);
  totalClaimed+=rows.length;totalOk+=result.ok;totalFailed+=result.failed;
  return{scan,item_type:itemType,claimed:rows.length,...result};
}

console.log(`[technical-snapshot-worker] started mode=${mode} batch=${batchSize} concurrency=${concurrency} scanEveryMs=${scanEveryMs} once=${once} itemType=${itemType||'any'} maxItems=${maxItems||'unbounded'}`);
for(;;){
  const started=Date.now();
  try{
    const result=await cycle();
    console.log('[technical-snapshot-worker]',JSON.stringify({...result,elapsed_ms:Date.now()-started,total_claimed:totalClaimed,total_ok:totalOk,total_failed:totalFailed}));
    if(once||result.limit_reached)break;
    if(mode==='backfill'&&result.queue_empty)break;
    if(result.claimed===0)await sleep(Math.min(idleMs,scanEveryMs));
  }catch(error){
    console.error('[technical-snapshot-worker] cycle failed',error);
    if(once||mode==='backfill')process.exitCode=1;
    if(once||mode==='backfill')break;
    await sleep(idleMs);
  }
}
console.log('[technical-snapshot-worker] finished',JSON.stringify({mode,item_type:itemType,total_claimed:totalClaimed,total_ok:totalOk,total_failed:totalFailed,max_items:maxItems||null}));
