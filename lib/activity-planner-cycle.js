import 'server-only';
import {runActivityPlanner} from './process-planning';
import {purgeTerminalProcessPlans} from './process-planning-retention';
import {purgeTerminalProcessObservability} from './process-observability-retention';
import {executeObservedProcess} from './process-runtime';

function summarize(result,purgedPlans,purgedProcessRuns){
  const created=result.demand.reduce((n,x)=>n+Number(x.created||0),0);
  const launched=result.dispatched.filter(x=>x.runId).length;
  const deferred=result.dispatched.filter(x=>x.deferred).length;
  const failed=result.dispatched.filter(x=>x.error).length;
  const changed=created||launched||deferred||failed||purgedPlans||purgedProcessRuns;
  return{
    functionalResult:changed?'updated':'no_change',
    metrics:{created_plans:created,launched,deferred,failed,purged_plans:purgedPlans,purged_process_runs:purgedProcessRuns,demand:result.demand},
    message:changed?`Planificación revisada: ${created} bloques nuevos, ${launched} lanzados, ${deferred} aplazados${failed?`, ${failed} con incidencia`:''}${purgedPlans?`, ${purgedPlans} planes antiguos purgados`:''}${purgedProcessRuns?`, ${purgedProcessRuns} ejecuciones técnicas antiguas purgadas`:''}`:'Planificación revisada sin cambios',
  };
}

export async function executeAutomaticPlanningCycle({triggerSource='activity_planner',runKind='system',entityId='automatic',idempotencyKey,manual=false}={}){
  return executeObservedProcess({
    processCode:'PROC-PLAN-002',
    runKind,
    triggerSource,
    executor:'vercel',
    entityType:'planning',
    entityId,
    idempotencyKey,
    context:{surface:'/actividad',operation:'reconcile_plan_dispatch',automatic:!manual,manual:Boolean(manual)},
  },async()=>{
    const purgedProcessRuns=await purgeTerminalProcessObservability();
    const purgedPlans=await purgeTerminalProcessPlans();
    const result=await runActivityPlanner();
    return summarize(result,purgedPlans,purgedProcessRuns);
  });
}
