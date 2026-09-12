import {NextResponse} from 'next/server';
import {executeAutomaticPlanningCycle} from '@/lib/activity-planner-cycle';
import {getCronAuthState,logCronAuthFailure} from '@/lib/cron-auth';

export const dynamic='force-dynamic';

function hourKey(){const d=new Date();return d.toISOString().slice(0,13);}

export async function GET(request){
  const auth=getCronAuthState(request);
  if(!auth.authorized){logCronAuthFailure('/api/cron/activity-planner',auth);return NextResponse.json({ok:false,error:'unauthorized'},{status:401});}
  try{
    const observed=await executeAutomaticPlanningCycle({triggerSource:'activity_planner',runKind:'system',entityId:'automatic',idempotencyKey:`PROC-PLAN-002:${hourKey()}`});
    return NextResponse.json({ok:true,reused:observed.reused,runId:observed.runId,result:observed.result||null});
  }catch(error){return NextResponse.json({ok:false,error:String(error?.message||error),runId:error?.runId||null},{status:500});}
}
