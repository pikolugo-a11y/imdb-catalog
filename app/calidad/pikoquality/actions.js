'use server';
// PikoQuality technical snapshot controls are intentionally driven from the frontend.
import {revalidatePath} from 'next/cache';
import {db} from '@/lib/db';
import {processC6Batch,C6_BATCH_SIZE,getC6BatchState} from '@/lib/pikoquality-c6-batch';
import {getTechnicalControl,setTechnicalArmed,setTechnicalRequestedState} from '@/lib/plex-technical-control.mjs';
import {startProcessRun,addProcessEvent,recordProcessError,finishProcessRun} from '@/lib/process-runtime';
import {getActiveTechnicalProcessRun} from '@/lib/pikoquality-technical-observability.mjs';

const C6_PROCESS_CODE='PROC-PQ-001';
const C6_ENTITY_TYPE='pikoquality';
const C6_ENTITY_ID='c6';
const TECH_PROCESS_CODE='PROC-PQ-002';
const TECH_ENTITY_TYPE='plex_library';
const TECH_ENTITY_ID='technical_snapshot';
const UUID_RE=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function startC6BatchRunAction(){
  const sql=db();
  const state=await getC6BatchState(sql);
  if(state.pending<=0)return{runId:null,reused:false,...state};
  const [active]=await sql`SELECT run_id FROM process_runs WHERE process_code=${C6_PROCESS_CODE} AND technical_status IN('queued','running') ORDER BY requested_at DESC LIMIT 1`;
  if(active?.run_id)return{runId:String(active.run_id),reused:true,...state};
  const started=await startProcessRun({
    processCode:C6_PROCESS_CODE,
    runKind:'batch',
    triggerSource:'calidad_pikoquality_manual',
    executor:'vercel',
    entityType:C6_ENTITY_TYPE,
    entityId:C6_ENTITY_ID,
    context:{formula_version:state.version,total:state.total,pending_at_start:state.pending,batch_size:C6_BATCH_SIZE},
  });
  await addProcessEvent(started.run.run_id,{eventType:'batch_ready',step:'c6',entityType:C6_ENTITY_TYPE,entityId:C6_ENTITY_ID,message:'Batch C6 preparado',data:{pending:state.pending,total:state.total,batch_size:C6_BATCH_SIZE}});
  return{runId:String(started.run.run_id),reused:started.reused,...state};
}

export async function runC6BatchChunkAction(runId){
  const id=String(runId||'');
  if(!UUID_RE.test(id))throw new Error('Run C6 inválido');
  const sql=db();
  const [run]=await sql`SELECT run_id,technical_status FROM process_runs WHERE run_id=${id}::uuid AND process_code=${C6_PROCESS_CODE} LIMIT 1`;
  if(!run)throw new Error('Run C6 no encontrado');
  if(run.technical_status!=='running'){
    const state=await getC6BatchState(sql);
    return{processed:0,remaining:state.pending,version:state.version,completed:state.pending===0,runId:id};
  }
  try{
    const result=await processC6Batch(C6_BATCH_SIZE);
    await addProcessEvent(id,{eventType:'batch_progress',step:'c6',entityType:C6_ENTITY_TYPE,entityId:C6_ENTITY_ID,message:'Bloque C6 completado',durationMs:result.elapsedMs,data:{processed:result.processed,remaining:result.remaining,items_per_second:result.itemsPerSecond,batch_size:C6_BATCH_SIZE}});
    if(result.remaining===0){
      await finishProcessRun(id,{technicalStatus:'succeeded',functionalResult:result.processed>0?'updated':'no_change',metrics:{formula_version:result.version,remaining:0,last_block_processed:result.processed,last_block_items_per_second:result.itemsPerSecond,aggregates:result.aggregates||null},message:'Cálculo C6 completado'});
    }
    revalidatePath('/calidad/pikoquality');revalidatePath('/calidad/peliculas');revalidatePath('/catalogo');revalidatePath('/admin');
    return{...result,completed:result.remaining===0,runId:id};
  }catch(error){
    await recordProcessError(id,{error,step:'c6_batch',source:'vercel',retryable:true}).catch(()=>{});
    await finishProcessRun(id,{technicalStatus:'failed',message:'Cálculo C6 fallido'}).catch(()=>{});
    throw error;
  }
}

const revalidateTechnical=()=>{revalidatePath('/calidad/pikoquality');revalidatePath('/admin')};

export async function startTechnicalSnapshotAction(){
  const sql=db();
  const control=await getTechnicalControl(sql);
  let active=await getActiveTechnicalProcessRun(sql);
  if(control?.requested_state==='paused'&&active){
    await setTechnicalArmed(sql,true);
    await setTechnicalRequestedState(sql,'running');
    await addProcessEvent(active.run_id,{eventType:'run_resumed',step:'technical_control',entityType:TECH_ENTITY_TYPE,entityId:TECH_ENTITY_ID,message:'Captura técnica reanudada'});
    revalidateTechnical();
    return;
  }
  if(!active){
    const started=await startProcessRun({processCode:TECH_PROCESS_CODE,runKind:'batch',triggerSource:'calidad_pikoquality_manual',executor:'railway',entityType:TECH_ENTITY_TYPE,entityId:TECH_ENTITY_ID,context:{mode:'incremental',phases:['scan','capture']}});
    active=started.run;
    await addProcessEvent(active.run_id,{eventType:'technical_requested',step:'technical_control',entityType:TECH_ENTITY_TYPE,entityId:TECH_ENTITY_ID,message:'Captura técnica solicitada desde PikoQuality'});
  }
  try{
    await setTechnicalArmed(sql,true);
    await setTechnicalRequestedState(sql,'running');
  }catch(error){
    await recordProcessError(active.run_id,{error,step:'technical_control',source:'vercel',retryable:false}).catch(()=>{});
    await finishProcessRun(active.run_id,{technicalStatus:'failed',message:'No se pudo iniciar la captura técnica'}).catch(()=>{});
    throw error;
  }
  revalidateTechnical();
}

export async function pauseTechnicalSnapshotAction(){
  const sql=db();
  await setTechnicalRequestedState(sql,'paused');
  const active=await getActiveTechnicalProcessRun(sql);
  if(active)await addProcessEvent(active.run_id,{eventType:'run_paused',step:'technical_control',entityType:TECH_ENTITY_TYPE,entityId:TECH_ENTITY_ID,message:'Captura técnica pausada'});
  revalidateTechnical();
}

export async function stopTechnicalSnapshotAction(){
  const sql=db();
  await setTechnicalRequestedState(sql,'stopped');
  const active=await getActiveTechnicalProcessRun(sql);
  if(active){
    await addProcessEvent(active.run_id,{eventType:'run_cancelled',step:'technical_control',entityType:TECH_ENTITY_TYPE,entityId:TECH_ENTITY_ID,message:'Captura técnica detenida por el usuario'});
    await finishProcessRun(active.run_id,{technicalStatus:'cancelled',functionalResult:'pending',message:'Captura técnica detenida'});
  }
  revalidateTechnical();
}
