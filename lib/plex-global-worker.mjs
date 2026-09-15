import {syncPlexFast} from './plex-sync.js';
import {captureDashboardSnapshot} from './dashboard-v2.js';
import {startPlexGlobalBatch} from './plex-global-batch.js';

async function withLeaseHeartbeat(trace,operation){
  let running=true,inFlight=false;
  const beat=async()=>{if(!running||inFlight)return;inFlight=true;try{await trace?.heartbeat?.({step:'plex_global'})}finally{inFlight=false}};
  await beat();
  const timer=setInterval(()=>{beat().catch(()=>{})},30000);
  try{return await operation()}finally{running=false;clearInterval(timer);await trace?.heartbeat?.({step:'plex_global_done'}).catch(()=>{})}
}

async function parentInfo(sql,runId){
  const[child]=await sql`SELECT parent_run_id FROM process_runs WHERE run_id=${runId}::uuid LIMIT 1`;
  if(!child?.parent_run_id)return{parentRunId:null,context:{}};
  const[parent]=await sql`SELECT run_id,context FROM process_runs WHERE run_id=${child.parent_run_id}::uuid LIMIT 1`;
  return{parentRunId:parent?.run_id||child.parent_run_id,context:parent?.context||{}};
}

export async function executeNov009(sql,id,{trace}={}){
  if(String(id)!=='global')throw Object.assign(new Error('NOV-009 sólo admite la unidad global'),{permanent:true,retryable:false,processStep:'validate_global_unit'});
  const parent=await parentInfo(sql,trace.runId),rawReview=String(parent.context?.review_from||'last_success'),reviewFrom=rawReview==='last_success'?undefined:rawReview;
  return withLeaseHeartbeat(trace,async()=>{
    await trace.event({eventType:'step_started',step:'plex_sync',message:'Sincronizando biblioteca Plex incrementalmente desde Railway',data:{review_from:reviewFrom||'last_success'}});
    const r=await syncPlexFast({reviewFrom});
    await trace.event({eventType:'step_completed',step:'plex_sync',message:'Biblioteca Plex sincronizada',data:{total:r.total,new:r.new,changed:r.changed,missing:r.missing,identity_review:r.identityReview||null}});
    await captureDashboardSnapshot().catch(async error=>{await trace.event({eventType:'warning',step:'dashboard_snapshot',message:'Plex se sincronizó, pero no se pudo refrescar el snapshot de Inicio',data:{error:String(error?.message||error)}}).catch(()=>{})});
    let continuation=null,continuationError=null;
    try{continuation=await startPlexGlobalBatch('PROC-NOV-008',{triggerSource:'plex_sync_continuation',parentRunId:parent.parentRunId||trace.runId})}
    catch(error){continuationError=String(error?.message||error);await trace.error?.(error,{step:'seed_dispatch',source:'railway_batch_plex',retryable:true,detail:{process:'PROC-NOV-008'}}).catch(()=>{})}
    const changed=Number(r.new||0)+Number(r.changed||0)+Number(r.missing||0)+Number(r.identityReview?.imdb_changed||0)>0;
    const review=r.identityReview?.review_from||reviewFrom||null;
    const message=continuationError?'Sincronización Plex global completada; la continuación de Novedades no pudo ponerse en cola':'Sincronización Plex global completada';
    return{...r,technicalStatus:'succeeded',functionalResult:changed?'updated':'no_change',metrics:{plex_total:r.total,plex_new:r.new,plex_changed:r.changed,plex_missing:r.missing,identity_reviewed:r.identityReview?.reviewed||0,imdb_changes:r.identityReview?.imdb_changed||0},after:{review_from:review,identity_review_complete:true,plex:{total:r.total,new:r.new,changed:r.changed,missing:r.missing},news_continuation_run_id:continuation?.run?.run_id||null,news_continuation_reused:Boolean(continuation?.reused),news_continuation_error:continuationError},message};
  });
}
