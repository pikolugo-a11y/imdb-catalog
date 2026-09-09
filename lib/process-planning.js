import 'server-only';
import {db} from './db';
import {selectMov001BatchEligibleIds,startMov001Batch} from './mov001-batch';
import {selectSer002BatchEligible,selectSer003BatchEligible,selectSer004BatchEligible,startSeriesBatch} from './series-batch';
import {selectData002BatchEligibleIds,startData002Batch} from './data002-batch';
import {selectPeopleBatchEligibleIds,startPeopleBatch} from './people-batch';
import {getC6BatchState,processC6Batch} from './pikoquality-c6-batch';
import {executeObservedProcess} from './process-runtime';

const DAY=86400000,HOUR=3600000;
export const PLANNER_HORIZON_DAYS=30;
export const SAFE_AUTOMATIC_PROCESS_CODES=['PROC-MOV-001','PROC-SER-002','PROC-SER-003','PROC-SER-004','PROC-DATA-002','PROC-PER-001','PROC-PQ-001'];

const POLICIES={
  'PROC-MOV-001':{domain:'calidad',title:'Validación de archivos de películas',block:100,windowDays:5,fallbackSeconds:2,eligible:sql=>selectMov001BatchEligibleIds(sql),dispatch:n=>startMov001Batch({limit:n,triggerSource:'quality_scheduler'})},
  'PROC-SER-002':{domain:'plex',title:'Continuación de cambios de Series detectados por Plex',block:50,windowDays:3,fallbackSeconds:3,eligible:sql=>selectSer002BatchEligible(sql),dispatch:n=>startSeriesBatch('PROC-SER-002',{limit:n,triggerSource:'quality_scheduler'})},
  'PROC-SER-003':{domain:'calidad',title:'Actualización de referencias de Series',block:50,windowDays:7,fallbackSeconds:4,eligible:sql=>selectSer003BatchEligible(sql),dispatch:n=>startSeriesBatch('PROC-SER-003',{limit:n,triggerSource:'quality_scheduler'})},
  'PROC-SER-004':{domain:'calidad',title:'Comprobación de disponibilidad de Series',block:50,windowDays:7,fallbackSeconds:4,eligible:sql=>selectSer004BatchEligible(sql),dispatch:n=>startSeriesBatch('PROC-SER-004',{limit:n,triggerSource:'quality_scheduler'})},
  'PROC-DATA-002':{domain:'calidad',title:'Actualización de valoraciones',block:150,windowDays:5,fallbackSeconds:5,eligible:sql=>selectData002BatchEligibleIds(sql),dispatch:n=>startData002Batch({limit:n,concurrency:2,triggerSource:'quality_scheduler'})},
  'PROC-PER-001':{domain:'personas',title:'Actualización de personas',block:25,windowDays:14,fallbackSeconds:6,eligible:sql=>selectPeopleBatchEligibleIds(sql),dispatch:n=>startPeopleBatch({limit:n,concurrency:2,triggerSource:'quality_scheduler'})},
  'PROC-PQ-001':{domain:'calidad',title:'Cálculo de PikoQuality',block:200,windowDays:5,fallbackSeconds:.25,eligible:async()=>Array.from({length:(await getC6BatchState()).pending},(_,i)=>i),dispatch:n=>executeObservedProcess({processCode:'PROC-PQ-001',runKind:'batch',triggerSource:'quality_scheduler',executor:'vercel',entityType:'pikoquality',entityId:'c6',context:{surface:'/actividad',operation:'planned_pikoquality_c6',automatic:true}},async()=>{const result=await processC6Batch(n);return{functionalResult:result.processed?'updated':'no_change',metrics:result,message:result.processed?`PikoQuality recalculado para ${result.processed} elementos`:'PikoQuality ya estaba al día'};})}
};

function slotCandidates(now,days){
  const out=[];for(let d=0;d<days;d++){for(const h of [3,7,11,15,19,23]){const x=new Date(now+d*DAY);x.setHours(h,0,0,0);if(x.getTime()>now+15*60000)out.push(x);}}return out;
}
async function recentSecondsPerItem(sql,code,fallback){
  const [r]=await sql.query(`SELECT sum(duration_ms)::numeric/1000 seconds,sum(GREATEST(COALESCE(items_processed,items_succeeded,items_total,1),1))::numeric items FROM process_runs WHERE process_code=$1 AND technical_status IN('succeeded','partial') AND requested_at>=now()-interval '30 days' AND duration_ms>0`,[code]);
  const seconds=Number(r?.seconds||0),items=Number(r?.items||0);return items&&seconds?Math.max(.05,seconds/items):fallback;
}
async function chooseSlot(sql,now,windowDays){
  const candidates=slotCandidates(now,windowDays);if(!candidates.length)return new Date(now+HOUR);
  const from=candidates[0],to=candidates[candidates.length-1];
  const rows=await sql.query(`SELECT date_trunc('hour',planned_at) slot,COALESCE(sum(estimated_load),0)::float load FROM process_plans WHERE status IN('planned','delayed','dispatched') AND planned_at BETWEEN $1 AND $2 GROUP BY 1`,[from,to]);
  const loads=new Map(rows.map(r=>[new Date(r.slot).toISOString().slice(0,13),Number(r.load||0)]));
  return candidates.reduce((best,x)=>{const key=x.toISOString().slice(0,13),score=loads.get(key)||0;if(score<(best.score??Infinity))return{x,score};return best},{x:candidates[0],score:Infinity}).x;
}
async function reconcileDispatched(sql){
  await sql.query(`UPDATE process_plans p SET status=CASE WHEN r.technical_status='cancelled' THEN 'cancelled' WHEN r.technical_status='failed' THEN 'delayed' ELSE 'completed' END,updated_at=now() FROM process_runs r WHERE p.status='dispatched' AND p.dispatch_run_id=r.run_id AND r.technical_status IN('succeeded','partial','failed','cancelled')`);
  await sql.query(`UPDATE process_plans SET status='delayed',updated_at=now() WHERE status='planned' AND planned_at<now()-interval '30 minutes'`);
}
async function replanDelayed(sql){
  const rows=await sql.query(`SELECT * FROM process_plans WHERE status='delayed' AND NOT protected AND NOT deliberate_peak ORDER BY priority DESC,planned_at ASC LIMIT 100`);
  for(const row of rows){const policy=POLICIES[row.process_code];if(!policy)continue;if(row.latest_at&&new Date(row.latest_at).getTime()<=Date.now()){await sql.query(`UPDATE process_plans SET status='expired',updated_at=now() WHERE plan_id=$1`,[row.plan_id]);continue;}const next=await chooseSlot(sql,Date.now(),Math.max(1,policy.windowDays));if(row.latest_at&&next>new Date(row.latest_at))continue;await sql.query(`UPDATE process_plans SET status='planned',planned_at=$2,updated_at=now(),metadata=metadata||jsonb_build_object('auto_replanned',true,'auto_replanned_at',now()) WHERE plan_id=$1`,[row.plan_id,next]);}
}
async function ensureDemand(sql,code,policy){
  const eligible=await policy.eligible(sql),due=eligible.length;
  const [active]=await sql.query(`SELECT COALESCE(sum(planned_volume),0)::int volume FROM process_plans WHERE process_code=$1 AND status IN('pending_planning','planned','delayed','dispatched')`,[code]);
  let missing=Math.max(0,due-Number(active?.volume||0));if(!missing)return{code,due,created:0};
  const secondsPerItem=await recentSecondsPerItem(sql,code,policy.fallbackSeconds);let created=0;
  while(missing>0){const volume=Math.min(policy.block,missing),earliest=new Date(),latest=new Date(Date.now()+policy.windowDays*DAY),estimated=volume*secondsPerItem;
    await sql.query(`INSERT INTO process_plans(process_code,domain,title,status,origin,earliest_at,latest_at,priority,estimated_load,planned_volume,metadata) VALUES($1,$2,$3,'pending_planning','automatic',$4,$5,50,$6,$7,jsonb_build_object('safe_window_days',$8,'seconds_per_item',$9))`,[code,policy.domain,policy.title,earliest,latest,estimated,volume,policy.windowDays,secondsPerItem]);missing-=volume;created++;}
  return{code,due,created};
}
async function planPending(sql){
  const rows=await sql.query(`SELECT * FROM process_plans WHERE status='pending_planning' AND NOT protected ORDER BY priority DESC,created_at ASC LIMIT 200`);
  for(const row of rows){const policy=POLICIES[row.process_code];if(!policy)continue;const now=Math.max(Date.now(),row.earliest_at?new Date(row.earliest_at).getTime():Date.now()),slot=await chooseSlot(sql,now,policy.windowDays);if(row.latest_at&&slot>new Date(row.latest_at))continue;await sql.query(`UPDATE process_plans SET status='planned',planned_at=$2,updated_at=now(),metadata=metadata||jsonb_build_object('auto_planned',true,'auto_planned_at',now()) WHERE plan_id=$1`,[row.plan_id,slot]);}
}
async function dispatchDue(sql){
  const rows=await sql.query(`SELECT * FROM process_plans WHERE status IN('planned','delayed') AND planned_at<=now() AND (latest_at IS NULL OR latest_at>=now()) ORDER BY deliberate_peak DESC,priority DESC,planned_at ASC LIMIT 200`),groups=new Map(),results=[];
  for(const row of rows){if(!POLICIES[row.process_code])continue;const group=groups.get(row.process_code)||{rows:[],volume:0};group.rows.push(row);group.volume+=Number(row.planned_volume||0);groups.set(row.process_code,group);}
  for(const [processCode,group] of groups){const policy=POLICIES[processCode],ids=group.rows.map(row=>row.plan_id);try{const result=await policy.dispatch(group.volume);const runId=result?.run?.run_id||result?.runId||null;if(runId){await sql.query(`UPDATE process_plans SET status='dispatched',dispatch_run_id=$2::uuid,updated_at=now() WHERE plan_id=ANY($1::uuid[])`,[ids,runId]);results.push({planIds:ids,processCode,runId,volume:group.volume});}else{await sql.query(`UPDATE process_plans SET status='completed',updated_at=now(),metadata=metadata||jsonb_build_object('dispatch_empty',true) WHERE plan_id=ANY($1::uuid[])`,[ids]);}}catch(error){await sql.query(`UPDATE process_plans SET status='delayed',updated_at=now(),metadata=metadata||jsonb_build_object('last_dispatch_error',$2,'last_dispatch_error_at',now()) WHERE plan_id=ANY($1::uuid[])`,[ids,String(error?.message||error).slice(0,300)]);results.push({planIds:ids,processCode,error:String(error?.message||error),volume:group.volume});}}
  return results;
}

export async function runActivityPlanner(){
  const sql=db();await reconcileDispatched(sql);await replanDelayed(sql);
  const demand=[];for(const code of SAFE_AUTOMATIC_PROCESS_CODES)demand.push(await ensureDemand(sql,code,POLICIES[code]));
  await planPending(sql);const dispatched=await dispatchDue(sql);
  return{demand,dispatched,safeProcesses:SAFE_AUTOMATIC_PROCESS_CODES};
}
