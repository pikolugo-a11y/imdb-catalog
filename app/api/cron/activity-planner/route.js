import {NextResponse} from 'next/server';
import {runActivityPlanner} from '@/lib/process-planning';
import {purgeTerminalProcessPlans} from '@/lib/process-planning-retention';
import {executeObservedProcess} from '@/lib/process-runtime';

export const dynamic='force-dynamic';

function authorized(request){const secret=process.env.CRON_SECRET;if(!secret)return false;return request.headers.get('authorization')===`Bearer ${secret}`;}
function hourKey(){const d=new Date();return d.toISOString().slice(0,13);}

export async function GET(request){
  if(!authorized(request))return NextResponse.json({ok:false,error:'unauthorized'},{status:401});
  try{
    const observed=await executeObservedProcess({processCode:'PROC-PLAN-002',runKind:'system',triggerSource:'activity_planner',executor:'vercel',entityType:'planning',entityId:'automatic',idempotencyKey:`PROC-PLAN-002:${hourKey()}`,context:{surface:'/actividad',operation:'reconcile_plan_dispatch',automatic:true}},async()=>{
      const purgedPlans=await purgeTerminalProcessPlans();
      const result=await runActivityPlanner();
      const created=result.demand.reduce((n,x)=>n+Number(x.created||0),0),launched=result.dispatched.filter(x=>x.runId).length,deferred=result.dispatched.filter(x=>x.deferred).length,failed=result.dispatched.filter(x=>x.error).length;
      return{functionalResult:created||launched||deferred||failed||purgedPlans?'updated':'no_change',metrics:{created_plans:created,launched,deferred,failed,purged_plans:purgedPlans,demand:result.demand},message:created||launched||deferred||failed||purgedPlans?`Planificación revisada: ${created} bloques nuevos, ${launched} lanzados, ${deferred} aplazados${failed?`, ${failed} con incidencia`:''}${purgedPlans?`, ${purgedPlans} planes antiguos purgados`:''}`:'Planificación revisada sin cambios'};
    });
    return NextResponse.json({ok:true,reused:observed.reused,runId:observed.runId,result:observed.result||null});
  }catch(error){return NextResponse.json({ok:false,error:String(error?.message||error),runId:error?.runId||null},{status:500});}
}
