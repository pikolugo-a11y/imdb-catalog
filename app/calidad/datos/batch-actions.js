'use server';
import {revalidatePath} from 'next/cache';
import {startData003Batch,pauseBatch,resumeBatch,cancelBatch} from '@/lib/batch-engine';
import {startData001Batch} from '@/lib/data001-batch';
import {startData002Batch} from '@/lib/data002-batch';

function refresh(){revalidatePath('/calidad/datos');revalidatePath('/calidad');revalidatePath('/admin');}
const runId=formData=>String(formData.get('runId')||'').trim();
const limitOf=formData=>{const raw=String(formData.get('limit')||'').trim();return raw?Number(raw):null};

export async function startData001BatchAction(formData){try{const r=await startData001Batch({limit:limitOf(formData),concurrency:2});refresh();if(r.empty)return{ok:true,message:'No hay títulos con datos estructurales pendientes.'};return{ok:true,runId:r.run?.run_id||null,message:r.reused?'Ya existe un Batch DATA-001 activo.':`Batch de datos preparado · ${r.eligibleCount} título(s) · concurrencia 2.`}}catch(error){refresh();return{ok:false,message:error?.message||'No se pudo iniciar el Batch de datos'}}}
export async function pauseData001BatchAction(formData){try{const id=runId(formData);if(!id)throw new Error('Run ID ausente');await pauseBatch(id,{reason:'manual'});refresh()}catch(error){refresh();throw error}}
export async function resumeData001BatchAction(formData){try{const id=runId(formData);if(!id)throw new Error('Run ID ausente');await resumeBatch(id);refresh()}catch(error){refresh();throw error}}
export async function cancelData001BatchAction(formData){try{const id=runId(formData);if(!id)throw new Error('Run ID ausente');await cancelBatch(id);refresh()}catch(error){refresh();throw error}}

export async function startData002BatchAction(formData){try{const r=await startData002Batch({limit:limitOf(formData),concurrency:2});refresh();if(r.empty)return{ok:true,message:'No hay títulos con ratings pendientes.'};return{ok:true,runId:r.run?.run_id||null,message:r.reused?'Ya existe un Batch DATA-002 activo.':`Batch ratings preparado · ${r.eligibleCount} título(s) · concurrencia 2.`}}catch(error){refresh();return{ok:false,message:error?.message||'No se pudo iniciar el Batch de ratings'}}}
export async function pauseData002BatchAction(formData){try{const id=runId(formData);if(!id)throw new Error('Run ID ausente');await pauseBatch(id,{reason:'manual'});refresh()}catch(error){refresh();throw error}}
export async function resumeData002BatchAction(formData){try{const id=runId(formData);if(!id)throw new Error('Run ID ausente');await resumeBatch(id);refresh()}catch(error){refresh();throw error}}
export async function cancelData002BatchAction(formData){try{const id=runId(formData);if(!id)throw new Error('Run ID ausente');await cancelBatch(id);refresh()}catch(error){refresh();throw error}}

export async function startData003BatchAction(){
  try{const r=await startData003Batch({concurrency:8});refresh();if(r.empty)return{ok:true,message:'No hay títulos listos para PikoScore.'};return{ok:true,runId:r.run?.run_id||null,message:r.reused?'Ya existe un Batch DATA-003 activo; se muestra esa ejecución.':`Batch preparado · ${r.eligibleCount} título(s) · concurrencia 8.`};}
  catch(error){refresh();return{ok:false,message:error?.message||'No se pudo iniciar el Batch PikoScore'}}
}
export async function pauseData003BatchAction(_prev,formData){try{const id=runId(formData);if(!id)throw new Error('Run ID ausente');await pauseBatch(id,{reason:'manual'});refresh();return{ok:true,message:'Pausa solicitada. Los títulos ya iniciados terminarán antes de detenerse.'}}catch(error){refresh();return{ok:false,message:error?.message||'No se pudo pausar el Batch'}}}
export async function resumeData003BatchAction(_prev,formData){try{const id=runId(formData);if(!id)throw new Error('Run ID ausente');await resumeBatch(id);refresh();return{ok:true,message:'Batch reanudado.'}}catch(error){refresh();return{ok:false,message:error?.message||'No se pudo reanudar el Batch'}}}
export async function cancelData003BatchAction(_prev,formData){try{const id=runId(formData);if(!id)throw new Error('Run ID ausente');await cancelBatch(id);refresh();return{ok:true,message:'Cancelación solicitada. El trabajo ya iniciado se conservará.'}}catch(error){refresh();return{ok:false,message:error?.message||'No se pudo cancelar el Batch'}}}
