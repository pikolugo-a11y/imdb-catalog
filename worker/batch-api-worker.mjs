import {claimBatchItem,executeClaimedItem,reconcileExpiredLeases,heartbeatPool,batchSql} from '../lib/batch-worker-runtime.mjs';
import {executeId001Canonical} from '../lib/id001-canonical.mjs';
import {executeIv001Canonical} from '../lib/identity-validation-canonical.mjs';
import {recomputeValidationLifecycle} from '../lib/validation-lifecycle-canonical.mjs';
import {createApiGate} from '../lib/batch-api-governance.mjs';
const POOL='api',CAPACITY=Math.max(1,Math.min(Number(process.env.BATCH_API_CAPACITY)||3,16)),POLL=Math.max(250,Number(process.env.BATCH_POLL_MS)||1000),workerId=`batch-api:${process.env.RAILWAY_REPLICA_ID||process.pid}`;
async function recomputeIdentityLifecycle(id,sql){const[row]=await sql`SELECT cl.lifecycle_state,m.tmdb_id FROM catalog_lifecycle cl JOIN movies m USING(imdb_id) WHERE cl.imdb_id=${id}`;if(!row)return null;const next=row.tmdb_id?'IDENTITY_VALIDATION':'IDENTITY_PENDING';await sql`UPDATE catalog_lifecycle SET previous_state=CASE WHEN lifecycle_state<>${next} THEN lifecycle_state ELSE previous_state END,lifecycle_state=${next},blocking_reason=CASE WHEN ${next}='IDENTITY_PENDING' THEN 'Falta identidad: TMDb' ELSE 'Identidad pendiente de validación' END,state_changed_at=CASE WHEN lifecycle_state<>${next} THEN now() ELSE state_changed_at END,computed_at=now() WHERE imdb_id=${id}`;return{state:next}}
const adapters={
 'PROC-ID-001':async(sql,id,{trace,item})=>executeId001Canonical(sql,id,{trace,lane:'batch',apiGate:createApiGate(sql,{batchRunId:item.batch_run_id}),recomputeLifecycle:recomputeIdentityLifecycle}),
 'PROC-IV-001':async(sql,id,{trace,item})=>executeIv001Canonical(sql,id,{trace,lane:'batch',apiGate:createApiGate(sql,{batchRunId:item.batch_run_id}),recomputeLifecycle:recomputeValidationLifecycle}),
};
const active=new Set();let stopping=false;
const nap=ms=>new Promise(r=>setTimeout(r,ms));
async function work(){while(!stopping){if(active.size>=CAPACITY){await nap(50);continue}const item=await claimBatchItem({pool:POOL,workerId});if(!item){await nap(POLL);continue}const execute=adapters[item.process_code];if(!execute){await batchSql`UPDATE batch_run_items SET status='failed',lease_owner=NULL,lease_until=NULL,last_error='Adapter API no registrado',finished_at=now(),updated_at=now() WHERE item_id=${item.item_id}`;continue}const task=executeClaimedItem(item,{workerId,executor:'railway_batch_api',errorSource:'batch_api_worker',execute:(sql,id,ctx)=>execute(sql,id,{...ctx,item})}).catch(error=>console.error(JSON.stringify({type:'batch_item_unhandled',pool:POOL,item_id:item.item_id,error:String(error?.message||error)}))).finally(()=>active.delete(task));active.add(task)}}
async function maintenance(){while(!stopping){try{await reconcileExpiredLeases({pool:POOL});await heartbeatPool(POOL)}catch(error){console.error(JSON.stringify({type:'batch_api_maintenance_error',error:String(error?.message||error)}))}await nap(15000)}}
process.on('SIGTERM',()=>{stopping=true});process.on('SIGINT',()=>{stopping=true});
console.log(JSON.stringify({type:'batch_worker_started',pool:POOL,worker_id:workerId,capacity:CAPACITY,adapters:Object.keys(adapters)}));
await Promise.all([work(),maintenance()]);
