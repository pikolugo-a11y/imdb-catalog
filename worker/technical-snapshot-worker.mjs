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

// Este servicio es el controlador permanente de captura técnica.
// Conservamos solo parámetros de capacidad; los flags de pruebas (ONCE, MODE,
// ITEM_TYPE, MAX_ITEMS) se ignoran deliberadamente para evitar que Railway
// considere el servicio caído cuando el proceso termina tras una prueba.
const batchSize=Math.max(1,Math.min(100,Number(process.env.TECHNICAL_SNAPSHOT_BATCH_SIZE)||25));
const concurrency=Math.max(1,Math.min(8,Number(process.env.TECHNICAL_SNAPSHOT_CONCURRENCY)||4));
const idleMs=Math.max(5000,Number(process.env.TECHNICAL_SNAPSHOT_IDLE_MS)||10000);
const scanEveryMs=Math.max(60000,Number(process.env.TECHNICAL_SNAPSHOT_SCAN_MS)||900000);
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
    const results=await Promise.allSettled(
      chunk.map(row=>captureTechnicalRatingKey(sql,{token,baseUrl,ratingKey:row.rating_key}))
    );
    for(const result of results){
      if(result.status==='fulfilled')ok++;
      else failed++;
    }
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
  const rows=await claimTechnicalBatch(sql,{limit:batchSize,itemType:null});

  if(!rows.length){
    await heartbeatTechnicalWorker(sql,{workerId,actualState:'completed'});
    return{scan,claimed:0,ok:0,failed:0,queue_empty:true};
  }

  const started=Date.now();
  const result=await processChunk(rows);
  const elapsed=Date.now()-started;
  totalClaimed+=rows.length;
  totalOk+=result.ok;
  totalFailed+=result.failed;
  await heartbeatTechnicalWorker(sql,{
    workerId,
    actualState:'running',
    lastBatchOk:result.ok,
    lastBatchFailed:result.failed,
    lastBatchMs:elapsed
  });
  return{scan,claimed:rows.length,...result};
}

console.log(`[technical-snapshot-worker] controller started id=${workerId} batch=${batchSize} concurrency=${concurrency} scanEveryMs=${scanEveryMs}`);

for(;;){
  const started=Date.now();
  try{
    const result=await cycle();
    console.log('[technical-snapshot-worker]',JSON.stringify({
      ...result,
      elapsed_ms:Date.now()-started,
      total_claimed:totalClaimed,
      total_ok:totalOk,
      total_failed:totalFailed
    }));

    // El controlador NUNCA termina por estado funcional. Detenido, pausado,
    // desarmado, completado o cola vacía significan reposo, no crash.
    if(result.control==='disarmed'||result.control==='paused'||result.control==='stopped'||result.claimed===0){
      await sleep(idleMs);
    }
  }catch(error){
    console.error('[technical-snapshot-worker] cycle failed',error);
    await heartbeatTechnicalWorker(sql,{
      workerId,
      actualState:'error',
      lastError:String(error?.message||error)
    }).catch(()=>{});
    // Un error de una iteración tampoco mata el controlador. Dejamos el error
    // visible en PikoQuality y reintentamos tras la espera de seguridad.
    await sleep(idleMs);
  }
}
