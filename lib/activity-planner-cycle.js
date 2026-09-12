import 'server-only';
import {runActivityPlanner,runActivityDispatchTick} from './process-planning';
import {purgeTerminalProcessPlans} from './process-planning-retention';
import {purgeTerminalProcessObservability} from './process-observability-retention';
import {executeObservedProcess} from './process-runtime';

function summarize(result,purgedPlans,purgedProcessRuns,mode){
  const demand=Array.isArray(result?.demand)?result.demand:[];
  const dispatched=Array.isArray(result?.dispatched)?result.dispatched:[];
  const created=demand.reduce((n,x)=>n+Number(x.created||0),0);
  const launched=dispatched.filter(x=>x.runId).length;
  const deferred=dispatched.filter(x=>x.deferred).length;
  const failed=dispatched.filter(x=>x.error).length;
  const changed=created||launched||deferred||failed||purgedPlans||purgedProcessRuns;
  const prefix=mode==='dispatch'?'Despacho automático revisado':'Planificación revisada';
  return{
    functionalResult:changed?'updated':'no_change',
    metrics:{mode,created_plans:created,launched,deferred,failed,purged_plans:purgedPlans,purged_process_runs:purgedProcessRuns,demand},
    message:changed?`${prefix}: ${created} bloques nuevos, ${launched} lanzados, ${deferred} aplazados${failed?`, ${failed} con incidencia`:''}${purgedPlans?`, ${purgedPlans} planes antiguos purgados`:''}${purgedProcessRuns?`, ${purgedProcessRuns} ejecuciones técnicas antiguas purgadas`:''}`:`${prefix} sin cambios`,
  };
}

export async function executeAutomaticPlanningCycle({triggerSource='activity_planner',runKind='system',entityId='automatic',idempotencyKey,manual=false,mode='full'}={}){
  const cycleMode=mode==='dispatch'?'dispatch':'full';
  return executeObservedProcess({
    processCode:'PROC-PLAN-002',
    runKind,
    triggerSource,
    executor:'vercel',
    entityType:'planning',
    entityId,
    idempotencyKey,
    context:{surface:'/actividad',operation:cycleMode==='dispatch'?'dispatch_due_plans':'reconcile_plan_dispatch',mode:cycleMode,automatic:!manual,manual:Boolean(manual)},
  },async()=>{
    if(cycleMode==='dispatch'){
      const result=await runActivityDispatchTick();
      return summarize(result,0,0,cycleMode);
    }
    const purgedProcessRuns=await purgeTerminalProcessObservability();
    const purgedPlans=await purgeTerminalProcessPlans();
    const result=await runActivityPlanner();
    return summarize(result,purgedPlans,purgedProcessRuns,cycleMode);
  });
}
