import {NextResponse} from 'next/server';
import {executeAutomaticPlanningCycle} from '@/lib/activity-planner-cycle';
import {getCronAuthState,logCronAuthFailure} from '@/lib/cron-auth';

export const dynamic='force-dynamic';

const FIVE_MINUTES=5*60*1000;
function slotKey(date=new Date()){
  return new Date(Math.floor(date.getTime()/FIVE_MINUTES)*FIVE_MINUTES).toISOString().slice(0,16);
}
function cycleMode(date){return date.getUTCMinutes()===0?'full':'dispatch';}

export async function GET(request){
  const auth=getCronAuthState(request);
  if(!auth.authorized){logCronAuthFailure('/api/cron/activity-planner',auth);return NextResponse.json({ok:false,error:'unauthorized'},{status:401});}
  const now=new Date(),mode=cycleMode(now);
  try{
    const observed=await executeAutomaticPlanningCycle({triggerSource:'activity_planner',runKind:'system',entityId:'automatic',mode,idempotencyKey:`PROC-PLAN-002:${mode}:${slotKey(now)}`});
    return NextResponse.json({ok:true,mode,reused:observed.reused,runId:observed.runId,result:observed.result||null});
  }catch(error){return NextResponse.json({ok:false,mode,error:String(error?.message||error),runId:error?.runId||null},{status:500});}
}
