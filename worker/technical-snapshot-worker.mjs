import {neon} from '@neondatabase/serverless';
import {randomUUID} from 'node:crypto';
import {scanPlexTechnicalLibrary} from '../lib/plex-technical-scan.mjs';
import {claimTechnicalBatch} from '../lib/plex-technical-queue.mjs';
import {captureTechnicalRatingKey} from '../lib/plex-technical-capture.mjs';
import {getTechnicalControl,heartbeatTechnicalWorker} from '../lib/plex-technical-control.mjs';
import {getActiveTechnicalProcessRun,addTechnicalProcessEvent,mergeTechnicalProcessContext,addTechnicalCaptureCounters,recordTechnicalProcessError,finishTechnicalProcessRun,reconcileStoppedTechnicalProcessRun} from '../lib/pikoquality-technical-observability.mjs';

const connectionString=process.env.DATABASE_URL||process.env.NEON_DATABASE_URL;
if(!connectionString)throw new Error('Falta DATABASE_URL/NEON_DATABASE_URL');
const token=process.env.PLEX_TOKEN;
if(!token)throw new Error('Falta PLEX_TOKEN');
const baseUrl=process.env.PLEX_URL||process.env.PLEX_BASE_URL||'';
const sql=neon(connectionString);

const batchSize=Math.max(1,Math.min(100,Number(process.env.TECHNICAL_SNAPSHOT_BATCH_SIZE)||25));
const concurrency=Math.max(1,Math.min(64,Number(process.env.TECHNICAL_SNAPSHOT_CONCURRENCY)||8));
const idleMs=Math.max(5000,Number(process.env.TECHNICAL_SNAPSHOT_IDLE_MS)||10000);
const scanEveryMs=Math.max(60000,Number(process.env.TECHNICAL_SNAPSHOT_SCAN_MS)||900000);
const workerId=`technical-${process.pid}-${randomUUID().slice(0,8)}`;

const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
let lastScanAt=0;
let totalClaimed=0,totalOk=0,totalFailed=0;

async function processChunk(rows,runId){
  let ok=0,failed=0,attempted=0;
  for(let pos=0;pos<rows.length;pos+=concurrency){
    const control=await getTechnicalControl(sql);
    if(!control.armed||control.requested_state!=='running')break;
    const chunk=rows.slice(pos,pos+concurrency);
    const results=await Promise.allSettled(chunk.map(row=>captureTechnicalRatingKey(sql,{token,baseUrl,ratingKey:row.rating_key})));
    attempted+=results.length;
    for(let i=0;i<results.length;i++){
      const result=results[i],row=chunk[i];
      if(result.status==='fulfilled')ok++;
      else{
        failed++;
        await recordTechnicalProcessError(sql,runId,{error:result.reason,step:'technical_capture',entityType:'plex_item',entityId:String(row.rating_key),retryable:true,detail:{rating_key:String(row.rating_key)}}).catch(()=>{});
      }
    }
  }
  return{ok,failed,attempted};
}

async function maybeScan(runId,force=false){
  const now=Date.now();
  if(!force&&now-lastScanAt<scanEveryMs)return null;
  await addTechnicalProcessEvent(sql,runId,{eventType:'step_started',step:'technical_scan',message:'Comprobación de biblioteca iniciada'});
  const result=await scanPlexTechnicalLibrary({sql,token,baseUrl});
  lastScanAt=Date.now();
  await mergeTechnicalProcessContext(sql,runId,{scan_total:result.total,scan_movies:result.movies,scan_episodes:result.episodes,scan_created:result.created,scan_changed:result.changed,scan_migrated:result.migrated,scan_elapsed_ms:result.elapsed_ms});
  await addTechnicalProcessEvent(sql,runId,{eventType:'step_finished',step:'technical_scan',message:'Comprobación de biblioteca completada',durationMs:result.elapsed_ms,data:{total:result.total,movies:result.movies,episodes:result.episodes,created:result.created,changed:result.changed,migrated:result.migrated,items_per_second:result.items_per_second}});
  return result;
}

async function finishIfEmpty(runId,scan){
  const [summary]=await sql`SELECT context,error_count FROM process_runs WHERE run_id=${runId}::uuid LIMIT 1`;
  const context=summary?.context||{};
  const created=Number(context.scan_created??scan?.created??0)||0;
  const changed=Number(context.scan_changed??scan?.changed??0)||0;
  const captureOk=Number(context.capture_ok||0)||0;
  const captureFailed=Number(context.capture_failed||0)||0;
  const errors=Number(summary?.error_count||0)||0;
  const technicalStatus=errors>0?'partial':'succeeded';
  const functionalResult=errors>0?'pending':(created+changed>0?'updated':'no_change');
  await finishTechnicalProcessRun(sql,runId,{technicalStatus,functionalResult,message:errors>0?'Captura técnica completada con incidencias':'Captura técnica completada',metrics:{scan_total:Number(context.scan_total||0)||0,created,changed,capture_ok:captureOk,capture_failed:captureFailed}});
}

async function reconcileIdleRun(){
  const run=await reconcileStoppedTechnicalProcessRun(sql).catch(error=>{
    console.error('[technical-snapshot-worker] reconcile failed',error);
    return null;
  });
  return Boolean(run);
}

async function cycle(){
  const control=await getTechnicalControl(sql);
  if(!control.armed){
    const reconciled=await reconcileIdleRun();
    await heartbeatTechnicalWorker(sql,{workerId,actualState:'stopped'});
    return{control:'disarmed',claimed:0,ok:0,failed:0,reconciled};
  }
  if(control.requested_state==='paused'){await heartbeatTechnicalWorker(sql,{workerId,actualState:'paused'});return{control:'paused',claimed:0,ok:0,failed:0}}
  if(control.requested_state==='stopped'){
    const reconciled=await reconcileIdleRun();
    await heartbeatTechnicalWorker(sql,{workerId,actualState:'stopped'});
    return{control:'stopped',claimed:0,ok:0,failed:0,reconciled};
  }

  const active=await getActiveTechnicalProcessRun(sql);
  if(!active){
    await heartbeatTechnicalWorker(sql,{workerId,actualState:'error',lastError:'No existe una ejecución PROC-PQ-002 activa'});
    return{control:'missing_process_run',claimed:0,ok:0,failed:0};
  }
  const runId=String(active.run_id);
  await heartbeatTechnicalWorker(sql,{workerId,actualState:'running'});
  const scan=await maybeScan(runId,lastScanAt===0);
  const rows=await claimTechnicalBatch(sql,{limit:batchSize,itemType:null});

  if(!rows.length){
    await heartbeatTechnicalWorker(sql,{workerId,actualState:'completed'});
    await finishIfEmpty(runId,scan);
    return{scan,claimed:0,ok:0,failed:0,queue_empty:true};
  }

  const started=Date.now();
  const result=await processChunk(rows,runId);
  const elapsed=Date.now()-started;
  totalClaimed+=result.attempted;totalOk+=result.ok;totalFailed+=result.failed;
  await addTechnicalCaptureCounters(sql,runId,{claimed:result.attempted,ok:result.ok,failed:result.failed});
  await addTechnicalProcessEvent(sql,runId,{eventType:'batch_progress',step:'technical_capture',message:'Bloque técnico completado',durationMs:elapsed,data:{claimed:result.attempted,ok:result.ok,failed:result.failed,batch_size:batchSize}});
  await heartbeatTechnicalWorker(sql,{workerId,actualState:'running',lastBatchOk:result.ok,lastBatchFailed:result.failed,lastBatchMs:elapsed});
  return{scan,claimed:result.attempted,ok:result.ok,failed:result.failed};
}

console.log(`[technical-snapshot-worker] controller started id=${workerId} batch=${batchSize} concurrency=${concurrency} scanEveryMs=${scanEveryMs}`);

for(;;){
  const started=Date.now();
  try{
    const result=await cycle();
    console.log('[technical-snapshot-worker]',JSON.stringify({...result,elapsed_ms:Date.now()-started,total_claimed:totalClaimed,total_ok:totalOk,total_failed:totalFailed}));
    if(['disarmed','paused','stopped','missing_process_run'].includes(result.control)||result.claimed===0)await sleep(idleMs);
  }catch(error){
    console.error('[technical-snapshot-worker] cycle failed',error);
    const active=await getActiveTechnicalProcessRun(sql).catch(()=>null);
    if(active?.run_id)await recordTechnicalProcessError(sql,String(active.run_id),{error,step:'technical_worker_cycle',retryable:true}).catch(()=>{});
    await heartbeatTechnicalWorker(sql,{workerId,actualState:'error',lastError:String(error?.message||error)}).catch(()=>{});
    await sleep(idleMs);
  }
}
