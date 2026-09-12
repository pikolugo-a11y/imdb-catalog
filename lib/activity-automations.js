import 'server-only';
import {db} from './db';
import {CONFIGURABLE_AUTOMATIONS,SYSTEM_AUTOMATIONS,AUTOMATION_PROFILES,loadAutomationSettings,automationProfile} from './activity-automation-settings';

const resultLabel={updated:'Cambios aplicados',no_change:'Sin cambios',pending:'Pendiente',blocked:'Bloqueado',not_found:'No encontrado',invalid:'Resultado no válido'};
const statusLabel={queued:'Pendiente',running:'En curso',succeeded:'Correcta',partial:'Con incidencias',failed:'Falló',cancelled:'Cancelada'};

function nextFiveMinuteTick(now=new Date()){
  const ms=5*60*1000;return new Date(Math.ceil((now.getTime()+1000)/ms)*ms);
}
function nextDashboardSnapshot(now=new Date()){
  const next=new Date(now);next.setUTCHours(2,15,0,0);if(next<=now)next.setUTCDate(next.getUTCDate()+1);return next;
}
function summarizeRun(run){
  if(!run)return null;
  return{at:run.requested_at,status:run.technical_status,statusLabel:statusLabel[run.technical_status]||run.technical_status,resultLabel:String(run.after_compact?.activity_summary||'').trim()||resultLabel[run.functional_result]||'Completada',runId:run.run_id};
}

export async function getActivityAutomations(){
  const sql=db(),settings=await loadAutomationSettings(sql),codes=CONFIGURABLE_AUTOMATIONS.map(x=>x.code),systemCodes=SYSTEM_AUTOMATIONS.map(x=>x.code);
  const [runs,plans,systemRuns]=await Promise.all([
    sql.query(`SELECT DISTINCT ON(process_code) process_code,run_id,technical_status,functional_result,requested_at,after_compact FROM process_runs WHERE process_code=ANY($1::text[]) AND parent_run_id IS NULL ORDER BY process_code,requested_at DESC`,[codes]),
    sql.query(`SELECT process_code,min(planned_at) FILTER(WHERE status='planned' AND planned_at>now()) next_at,COALESCE(sum(planned_volume) FILTER(WHERE status IN('pending_planning','planned','delayed','dispatched')),0)::bigint pending_volume,count(*) FILTER(WHERE status IN('pending_planning','planned','delayed','dispatched'))::int pending_blocks,count(*) FILTER(WHERE status='pending_planning')::int waiting_planning,count(*) FILTER(WHERE status='delayed')::int delayed_blocks FROM process_plans WHERE process_code=ANY($1::text[]) GROUP BY process_code`,[codes]),
    sql.query(`SELECT DISTINCT ON(process_code) process_code,run_id,technical_status,functional_result,requested_at,after_compact FROM process_runs WHERE process_code=ANY($1::text[]) AND parent_run_id IS NULL ORDER BY process_code,requested_at DESC`,[systemCodes])
  ]);
  const runMap=new Map(runs.map(x=>[x.process_code,x])),planMap=new Map(plans.map(x=>[x.process_code,x])),systemRunMap=new Map(systemRuns.map(x=>[x.process_code,x]));
  const configurable=CONFIGURABLE_AUTOMATIONS.map(def=>{const config=settings.processes[def.code],profile=automationProfile(config.profile),plan=planMap.get(def.code);return{...def,enabled:config.enabled,profile:config.profile,profileLabel:profile.label,profileDescription:profile.description,hours:profile.hours,lastRun:summarizeRun(runMap.get(def.code)),nextAt:plan?.next_at||null,pendingVolume:Number(plan?.pending_volume||0),pendingBlocks:Number(plan?.pending_blocks||0),waitingPlanning:Number(plan?.waiting_planning||0),delayedBlocks:Number(plan?.delayed_blocks||0)};});
  const now=new Date();
  const system=SYSTEM_AUTOMATIONS.map(def=>({...def,lastRun:summarizeRun(systemRunMap.get(def.code)),nextAt:def.code==='PROC-PLAN-002'?nextFiveMinuteTick(now):def.code==='PROC-HOME-001'?nextDashboardSnapshot(now):null}));
  return{configurable,system,profiles:Object.entries(AUTOMATION_PROFILES).map(([key,value])=>({key,label:value.label,description:value.description,hours:value.hours}))};
}
