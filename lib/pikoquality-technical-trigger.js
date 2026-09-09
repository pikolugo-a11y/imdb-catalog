import 'server-only';
import {db} from './db';
import {getTechnicalControl,setTechnicalArmed,setTechnicalRequestedState} from './plex-technical-control.mjs';
import {getActiveTechnicalProcessRun} from './pikoquality-technical-observability.mjs';
import {startProcessRun,addProcessEvent} from './process-runtime';

const PROCESS='PROC-PQ-002';

export async function triggerTechnicalSnapshot({triggerSource='plex_sync_continuation',force=false}={}){
  const sql=db();
  const control=await getTechnicalControl(sql);
  let active=await getActiveTechnicalProcessRun(sql);

  // A user pause/stop is a deliberate operational override. Automatic events do not undo it.
  const explicitHold=Boolean(control?.armed)&&['paused','stopped'].includes(control?.requested_state)&&control?.actual_state!=='completed';
  if(explicitHold&&!force)return{started:false,deferred:true,reason:`technical_${control.requested_state}`,runId:active?.run_id?String(active.run_id):null};

  if(!active){
    const started=await startProcessRun({
      processCode:PROCESS,
      runKind:'batch',
      triggerSource,
      executor:'railway',
      entityType:'plex_library',
      entityId:'technical_snapshot',
      context:{mode:'event_driven',phases:['scan','capture'],automatic:triggerSource!=='calidad_pikoquality_manual'}
    });
    active=started.run;
    await addProcessEvent(active.run_id,{eventType:'technical_requested',step:'technical_control',entityType:'plex_library',entityId:'technical_snapshot',message:'Captura técnica solicitada por cambio físico'});
  }

  await setTechnicalArmed(sql,true);
  await setTechnicalRequestedState(sql,'running');
  await addProcessEvent(active.run_id,{eventType:'technical_armed',step:'technical_control',entityType:'plex_library',entityId:'technical_snapshot',message:'Worker técnico habilitado para procesar cambios físicos',data:{trigger_source:triggerSource}});
  return{started:true,deferred:false,runId:String(active.run_id)};
}
