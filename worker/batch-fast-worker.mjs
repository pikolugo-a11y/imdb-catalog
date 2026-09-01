import {claimBatchItem,executeClaimedItem,reconcileExpiredLeases,heartbeatPool} from '../lib/batch-worker-runtime.mjs';
import {executeData003Canonical} from '../lib/data003-canonical.mjs';
import {executeMov001Canonical} from '../lib/mov001-canonical.mjs';
import {validateIdentityCanonical} from '../lib/identity-validation-canonical.mjs';
import {recomputeLifecycleWithSql} from '../lib/lifecycle-recompute-core.mjs';

const POOL='fast';
const CAPACITY=Math.max(1,Math.min(Number(process.env.BATCH_FAST_CAPACITY)||8,32));
const IDLE_MS=Math.max(250,Math.min(Number(process.env.BATCH_IDLE_MS)||1000,10000));
const HEARTBEAT_MS=Math.max(5000,Math.min(Number(process.env.BATCH_HEARTBEAT_MS)||20000,60000));
const workerId=`batch-fast:${process.env.RAILWAY_REPLICA_ID||process.env.HOSTNAME||process.pid}`;
async function executeIv002(sql,id,{trace}){const[cl]=await sql`SELECT lifecycle_state FROM catalog_lifecycle WHERE imdb_id=${id}`;if(!cl||cl.lifecycle_state!=='IDENTITY_VALIDATION')throw Object.assign(new Error('El título ya no está listo para validar identidad'),{permanent:true});const[before]=await sql`SELECT validation_status,validation_score,suspected_source,validated_at,validation_details FROM identity_validation WHERE imdb_id=${id}`;await trace.event({eventType:'step_started',step:'lifecycle_guard',message:'Comprobando fase de Validación de identidad',data:{lifecycle_state:cl.lifecycle_state}});const v=await validateIdentityCanonical(sql,id,{trace});await trace.event({eventType:'step_started',step:'recompute_lifecycle',message:'Recalculando Lifecycle'});const lifecycle=await recomputeLifecycleWithSql(sql,[id]),next=lifecycle.get(id)?.label||'siguiente fase';await trace.event({eventType:'step_completed',step:'recompute_lifecycle',message:'Lifecycle recalculado',data:{next}});const functionalResult=v.status==='valid'?'updated':v.status==='insufficient'?'pending':'blocked';return{...v,next,technicalStatus:'succeeded',functionalResult,before:{validation_status:before?.validation_status||null,validation_score:before?.validation_score??null,suspected_source:before?.suspected_source||null,had_manual:Boolean(before?.validation_details?.manual)},after:{validation_status:v.status,automatic_status:v.automaticStatus||v.status,validation_score:v.score??null,suspected_source:v.suspected||null,manual_applied:Boolean(v.manualApplied),lifecycle:next},metrics:{validation_status:v.status,automatic_status:v.automaticStatus||v.status,score:v.score??null,manual_applied:Boolean(v.manualApplied)},message:v.status==='valid'?'Identidad validada':v.status==='insufficient'?'Evidencia insuficiente para validar':'Identidad requiere revisión'}}
const adapters=new Map([
  ['PROC-DATA-003',{execute:executeData003Canonical}],
  ['PROC-MOV-001',{execute:executeMov001Canonical}],
  ['PROC-IV-002',{execute:executeIv002}],
]);
let stopping=false;
const active=new Set();
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function launch(item){const adapter=adapters.get(item.process_code);if(!adapter){console.error(JSON.stringify({type:'batch_adapter_missing',process_code:item.process_code,item_id:item.item_id}));return executeClaimedItem(item,{workerId,execute:async()=>{throw Object.assign(new Error(`No hay adapter para ${item.process_code}`),{permanent:true,retryable:false});}})}return executeClaimedItem(item,{workerId,execute:adapter.execute})}
async function fill(){while(!stopping&&active.size<CAPACITY){const item=await claimBatchItem({pool:POOL,workerId});if(!item)break;const promise=launch(item).then(result=>console.log(JSON.stringify({type:'batch_item_done',process_code:item.process_code,item_id:item.item_id,entity_id:item.entity_id,ok:result.ok,requeued:Boolean(result.requeued),child_run_id:result.childRunId}))).catch(error=>console.error(JSON.stringify({type:'batch_item_unhandled',item_id:item.item_id,error:String(error?.message||error)}))).finally(()=>active.delete(promise));active.add(promise)}}
async function main(){console.log(JSON.stringify({type:'batch_worker_started',pool:POOL,worker_id:workerId,capacity:CAPACITY,adapters:[...adapters.keys()]}));let lastHeartbeat=0,lastReconcile=0;while(!stopping){const now=Date.now();if(now-lastReconcile>=HEARTBEAT_MS){const r=await reconcileExpiredLeases({pool:POOL});if(r.checked)console.log(JSON.stringify({type:'batch_reconcile',...r}));lastReconcile=now}if(now-lastHeartbeat>=HEARTBEAT_MS){await heartbeatPool(POOL);lastHeartbeat=now}await fill();if(active.size===0)await sleep(IDLE_MS);else await Promise.race([sleep(250),...active])}await Promise.allSettled([...active]);console.log(JSON.stringify({type:'batch_worker_stopped',pool:POOL,worker_id:workerId}))}
for(const signal of ['SIGTERM','SIGINT'])process.on(signal,()=>{stopping=true;console.log(JSON.stringify({type:'batch_worker_stopping',signal,active:active.size}))});
main().catch(error=>{console.error(JSON.stringify({type:'batch_worker_fatal',error:String(error?.stack||error)}));process.exitCode=1});
