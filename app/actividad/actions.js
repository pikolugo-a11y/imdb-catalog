'use server';
import {revalidatePath} from 'next/cache';
import {db} from '@/lib/db';
import {executeObservedProcess} from '@/lib/process-runtime';

async function mutatePlan(planId,operation,apply){
  const sql=db();const [before]=await sql.query(`SELECT * FROM process_plans WHERE plan_id=$1::uuid LIMIT 1`,[planId]);if(!before)throw new Error('Plan no encontrado');
  const observed=await executeObservedProcess({processCode:'PROC-PLAN-001',runKind:'individual',triggerSource:'activity_manual',executor:'vercel',entityType:'planning',entityId:String(planId),context:{surface:'/actividad',operation}},async()=>{
    await apply(sql,before);const [after]=await sql.query(`SELECT * FROM process_plans WHERE plan_id=$1::uuid LIMIT 1`,[planId]);
    return{functionalResult:'updated',before:{status:before.status,planned_at:before.planned_at,priority:before.priority,protected:before.protected,deliberate_peak:before.deliberate_peak},after:{status:after.status,planned_at:after.planned_at,priority:after.priority,protected:after.protected,deliberate_peak:after.deliberate_peak},message:'Planificación modificada por el usuario'};
  });revalidatePath('/actividad');return observed.runId;
}
export async function reschedulePlan(formData){const id=String(formData.get('planId')||''),when=String(formData.get('plannedAt')||'');if(!when)throw new Error('Fecha obligatoria');return mutatePlan(id,'reschedule',async(sql,b)=>{const date=new Date(when);if(Number.isNaN(date.getTime()))throw new Error('Fecha no válida');if(b.earliest_at&&date<new Date(b.earliest_at))throw new Error('La fecha está antes de la ventana segura');if(b.latest_at&&date>new Date(b.latest_at))throw new Error('La fecha supera la ventana segura');await sql.query(`UPDATE process_plans SET planned_at=$2,status='planned',origin='user',protected=true,updated_at=now() WHERE plan_id=$1::uuid`,[id,date]);});}
export async function setPlanPriority(formData){const id=String(formData.get('planId')||''),priority=Math.max(0,Math.min(100,Number(formData.get('priority'))||0));return mutatePlan(id,'set_priority',(sql)=>sql.query(`UPDATE process_plans SET priority=$2,origin='user',updated_at=now() WHERE plan_id=$1::uuid`,[id,priority]));}
export async function togglePlanProtection(formData){const id=String(formData.get('planId')||''),value=String(formData.get('value'))==='true';return mutatePlan(id,value?'protect':'unprotect',(sql)=>sql.query(`UPDATE process_plans SET protected=$2,origin='user',updated_at=now() WHERE plan_id=$1::uuid`,[id,value]));}
export async function toggleDeliberatePeak(formData){const id=String(formData.get('planId')||''),value=String(formData.get('value'))==='true';return mutatePlan(id,value?'mark_deliberate_peak':'clear_deliberate_peak',(sql)=>sql.query(`UPDATE process_plans SET deliberate_peak=$2,protected=CASE WHEN $2 THEN true ELSE protected END,origin='user',updated_at=now() WHERE plan_id=$1::uuid`,[id,value]));}
