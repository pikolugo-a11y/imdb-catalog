import {neon} from '@neondatabase/serverless';
import {randomUUID} from 'node:crypto';
import {scanPlexTechnicalLibrary} from '../lib/plex-technical-scan.mjs';
import {claimTechnicalBatch} from '../lib/plex-technical-queue.mjs';
import {captureTechnicalRatingKey} from '../lib/plex-technical-capture.mjs';
import {getTechnicalControl,heartbeatTechnicalWorker} from '../lib/plex-technical-control.mjs';

const connectionString=process.env.DATABASE_URL||process.env.NEON_DATABASE_URL;
if(!connectionString)throw new Error('Falta DATABASE_URL/NEON_DATABASE_URL');
const token=process.env.PLEX_TOKEN;
if(!token)throw new Error('Falta PLEX_TOKEN');
const baseUrl=process.env.PLEX_URL||process.env.PLEX_BASE_URL||'';
const sql=neon(connectionString);
const batchSize=Math.max(1,Math.min(100,Number(process.env.TECHNICAL_SNAPSHOT_BATCH_SIZE)||25));
const concurrency=Math.max(1,Math.min(8,Number(process.env.TECHNICAL_SNAPSHOT_CONCURRENCY)||4));
const idleMs=Math.max(5000,Number(process.env.TECHNICAL_SNAPSHOT_IDLE_MS)||10000);
const scanEveryMs=Math.max(60000,Number(process.env.TECHNICAL_SNAPSHOT_SCAN_MS)||900000);
const once=String(process.env.TECHNICAL_SNAPSHOT_ONCE||'').toLowerCase()==='true';
const mode=String(process.env.TECHNICAL_SNAPSHOT_MODE||'incremental').trim().toLowerCase();
if(!['incremental','backfill'].includes(mode))throw new Error(`TECHNICAL_SNAPSHOT_MODE no soportado: ${mode}`);
const requestedItemType=String(process.env.TECHNICAL_SNAPSHOT_ITEM_TYPE||'').trim().toLowerCase();
const itemType=['movie','episode'].includes(requestedItemType)?requestedItemType:null;
const maxItemsRaw=Number(process.env.TECHNICAL_SNAPSHOT_MAX_ITEMS||0);
const maxItems=Number.isFinite(maxItemsRaw)&&maxItemsRaw>0?Math.floor(maxItemsRaw):0;
const workerId=`technical-${process.pid}-${randomUUID().slice(0,8)}`;

const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
let lastScanAt=0;
let totalClaimed=0,totalOk=0,totalFailed=0;

async function processChunk(rows){
  let ok=0,failed=0;
  for(let pos=0;pos<rows.length;pos+=concurrency){
    const control=await getTechnicalControl(sql);
    if(!control.armed||control.requested_state!=='running')break;
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
  const control=await getTechnicalControl(sql);
  if(!control.armed){
    await heartbeatTechnicalWorker(sql,{workerId,actualState:'stopped'});
    return{control:'disarmed',claimed:0,ok:0,failed:0};
  }
  if(control.requested_state==='paused'){
    await heartbeatTechnicalWorker(sql,{workerId,actualState:'paused'});
    return{control:'paused',claimed:0,ok:0,failed:0};
  }
  if(control.requested_state==='stopped'){
    await heartbeatTechnicalWorker(sql,{workerId,actualState:'stopped'});
    return{control:'stopped',claimed:0,ok:0,failed:0};
  }
  await heartbeatTechnicalWorker(sql,{workerId,actualState:'running'});
  const scan=await maybeScan(lastScanAt===0);
  const remainingAllowance=maxItems?Math.max(0,maxItems-totalClaimed):batchSize;
  if(maxItems&&remainingAllowance===0)return{scan,item_type:itemType,claimed:0,ok:0,failed:0,limit_reached:true};
  const limit=maxItems?Math.min(batchSize,remainingAllowance):batchSize;
  const rows=await claimTechnicalBatch(sql,{limit,itemType});
  if(!rows.length)return{scan,item_type:itemType,claimed:0,ok:0,failed:0,queue_empty:true};
  const started=Date.now();
  const result=await processChunk(rows);
  const elapsed=Date.now()-started;
  totalClaimed+=rows.length;totalOk+=result.ok;totalFailed+=result.failed;
  await heartbeatTechnicalWorker(sql,{workerId,actualState:'running',lastBatchOk:result.ok,lastBatchFailed:result.failed,lastBatchMs:elapsed});
  return{scan,item_type:itemType,claimed:rows.length,...result};
}

console.log(`[technical-snapshot-worker] started id=${workerId} mode=${mode} batch=${batchSize} concurrency=${concurrency} scanEveryMs=${scanEveryMs} once=${once} itemType=${itemType||'any'} maxItems=${maxItems||'unbounded'}`);
for(;;){
  const started=Date.now();
  try{
    const result=await cycle();
    console.log('[technical-snapshot-worker]',JSON.stringify({...result,elapsed_ms:Date.now()-started,total_claimed:totalClaimed,total_ok:totalOk,total_failed:totalFailed}));
    if(once||result.limit_reached)break;
    if(result.queue_empty){
      await heartbeatTechnicalWorker(sql,{workerId,actualState:'completed'});
      if(mode==='backfill')break;
    }
    if(mode==='backfill'&&['disarmed','paused','stopped'].includes(result.control))break;
    if(result.control==='disarmed'||result.control==='paused'||result.control==='stopped'||result.claimed===0)await sleep(idleMs);
  }catch(error){
    console.error('[technical-snapshot-worker] cycle failed',error);
    await heartbeatTechnicalWorker(sql,{workerId,actualState:'error',lastError:String(error?.message||error)}).catch(()=>{});
    if(once||mode==='backfill')process.exitCode=1;
    if(once||mode==='backfill')break;
    await sleep(idleMs);
  }
}
console.log('[technical-snapshot-worker] finished',JSON.stringify({mode,item_type:itemType,total_claimed:totalClaimed,total_ok:totalOk,total_failed:totalFailed,max_items:maxItems||null}));
