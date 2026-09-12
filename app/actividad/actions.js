'use server';
import {revalidatePath} from 'next/cache';
import {db} from '@/lib/db';
import {executeObservedProcess} from '@/lib/process-runtime';
import {executeAutomaticPlanningCycle} from '@/lib/activity-planner-cycle';
import {loadAutomationSettings,saveAutomationSetting,isConfigurableAutomation,AUTOMATION_PROFILES,automationProfile} from '@/lib/activity-automation-settings';

const MADRID_TZ='Europe/Madrid';
function madridLocalToUtc(value){
  const match=String(value||'').match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/);if(!match)throw new Error('Fecha no válida');
  const target={year:+match[1],month:+match[2],day:+match[3],hour:+match[4],minute:+match[5]},targetEpoch=Date.UTC(target.year,target.month-1,target.day,target.hour,target.minute);let candidate=targetEpoch;
  const formatter=new Intl.DateTimeFormat('en-GB',{timeZone:MADRID_TZ,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'});
  for(let pass=0;pass<3;pass++){const parts=Object.fromEntries(formatter.formatToParts(new Date(candidate)).filter(x=>x.type!=='literal').map(x=>[x.type,+x.value]));const represented=Date.UTC(parts.year,parts.month-1,parts.day,parts.hour,parts.minute);candidate+=targetEpoch-represented;}
  const date=new Date(candidate);if(Number.isNaN(date.getTime()))throw new Error('Fecha no válida');return date;
}
async function mutatePlan(planId,operation,apply){
  const sql=db();const [before]=await sql.query(`SELECT * FROM process_plans WHERE plan_id=$1::uuid LIMIT 1`,[planId]);if(!before)throw new Error('Plan no encontrado');
  const observed=await executeObservedProcess({processCode:'PROC-PLAN-001',runKind:'individual',triggerSource:'activity_manual',executor:'vercel',entityType:'planning',entityId:String(planId),context:{surface:'/actividad',operation}},async()=>{
    await apply(sql,before);const [after]=await sql.query(`SELECT * FROM process_plans WHERE plan_id=$1::uuid LIMIT 1`,[planId]);
    return{functionalResult:'updated',before:{status:before.status,planned_at:before.planned_at,priority:before.priority,protected:before.protected,deliberate_peak:before.deliberate_peak},after:{status:after.status,planned_at:after.planned_at,priority:after.priority,protected:after.protected,deliberate_peak:after.deliberate_peak},message:'Planificación modificada por el usuario'};
  });revalidatePath('/actividad');return observed.runId;
}
export async function runAutomaticPlanningNow(){
  const observed=await executeAutomaticPlanningCycle({triggerSource:'activity_manual',runKind:'individual',entityId:'manual',idempotencyKey:`PROC-PLAN-002:manual:${Date.now()}`,manual:true});
  revalidatePath('/actividad');
  revalidatePath('/admin');
  return observed.runId;
}
// Compatibilidad interna con cualquier referencia anterior; ejecuta ya el ciclo canónico PROC-PLAN-002.
export async function recalculatePlanningNow(){return runAutomaticPlanningNow();}
export async function reschedulePlan(formData){const id=String(formData.get('planId')||''),when=String(formData.get('plannedAt')||'');if(!when)throw new Error('Fecha obligatoria');return mutatePlan(id,'reschedule',async(sql,b)=>{const date=madridLocalToUtc(when);if(b.earliest_at&&date<new Date(b.earliest_at))throw new Error('La fecha está antes de la ventana segura');if(b.latest_at&&date>new Date(b.latest_at))throw new Error('La fecha supera la ventana segura');await sql.query(`UPDATE process_plans SET planned_at=$2,status='planned',origin='user',protected=true,updated_at=now() WHERE plan_id=$1::uuid`,[id,date]);});}
export async function setPlanPriority(formData){const id=String(formData.get('planId')||''),priority=Math.max(0,Math.min(100,Number(formData.get('priority'))||0));return mutatePlan(id,'set_priority',(sql)=>sql.query(`UPDATE process_plans SET priority=$2,origin='user',updated_at=now() WHERE plan_id=$1::uuid`,[id,priority]));}
export async function togglePlanProtection(formData){const id=String(formData.get('planId')||''),value=String(formData.get('value'))==='true';return mutatePlan(id,value?'protect':'unprotect',(sql)=>sql.query(`UPDATE process_plans SET protected=$2,origin='user',updated_at=now() WHERE plan_id=$1::uuid`,[id,value]));}
export async function toggleDeliberatePeak(formData){const id=String(formData.get('planId')||''),value=String(formData.get('value'))==='true';return mutatePlan(id,value?'mark_deliberate_peak':'clear_deliberate_peak',(sql)=>sql.query(`UPDATE process_plans SET deliberate_peak=$2,protected=CASE WHEN $2 THEN true ELSE protected END,origin='user',updated_at=now() WHERE plan_id=$1::uuid`,[id,value]));}

export async function updateAutomationSchedule(formData){
  const code=String(formData.get('processCode')||''),profile=String(formData.get('profile')||'balanced'),enabled=String(formData.get('enabled')||'')==='true';
  if(!isConfigurableAutomation(code))throw new Error('Automatización no configurable');if(!AUTOMATION_PROFILES[profile])throw new Error('Franja no válida');
  const sql=db(),beforeSettings=await loadAutomationSettings(sql),before=beforeSettings.processes[code],afterProfile=automationProfile(profile);
  const observed=await executeObservedProcess({processCode:'PROC-PLAN-001',runKind:'individual',triggerSource:'activity_manual',executor:'vercel',entityType:'planning',entityId:`automation:${code}`,context:{surface:'/actividad',operation:'automation_schedule_change',target_process:code}},async()=>{
    await saveAutomationSetting(sql,code,{enabled,profile});
    if(!enabled){await sql.query(`UPDATE process_plans SET status='cancelled',updated_at=now(),metadata=metadata||jsonb_build_object('cancelled_by_automation_pause',true,'cancelled_at',now()) WHERE process_code=$1 AND status IN('pending_planning','planned','delayed') AND dispatch_run_id IS NULL`,[code]);}
    else if(before?.profile!==profile||before?.enabled===false){await sql.query(`UPDATE process_plans SET status='pending_planning',planned_at=NULL,updated_at=now(),metadata=metadata||jsonb_build_object('replan_after_schedule_change',true,'replan_requested_at',now()) WHERE process_code=$1 AND status IN('planned','delayed') AND origin='automatic' AND NOT protected AND dispatch_run_id IS NULL`,[code]);}
    const beforeProfile=automationProfile(before?.profile).label,verb=enabled?'Activaste':'Pausaste',summary=before?.enabled===enabled&&before?.profile!==profile?`Cambiaste ${code} de ${beforeProfile} a ${afterProfile.label}.`:`${verb} ${code}${enabled?` en franja ${afterProfile.label}`:''}.`;
    return{functionalResult:'updated',before:{enabled:before?.enabled!==false,profile:before?.profile||'balanced'},after:{enabled,profile,activity_summary:summary},message:summary};
  });
  revalidatePath('/actividad');return observed.runId;
}
