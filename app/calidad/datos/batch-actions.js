'use server';
import {revalidatePath} from 'next/cache';
import {startData003Batch,pauseBatch,resumeBatch,cancelBatch} from '@/lib/batch-engine';

function refresh(){revalidatePath('/calidad/datos');revalidatePath('/calidad');revalidatePath('/admin');}
const runId=formData=>String(formData.get('runId')||'').trim();

export async function startData003BatchAction(){
  try{const r=await startData003Batch({concurrency:8});refresh();if(r.empty)return{ok:true,message:'No hay títulos listos para PikoScore.'};return{ok:true,runId:r.run?.run_id||null,message:r.reused?'Ya existe un Batch DATA-003 activo; se muestra esa ejecución.':`Batch preparado · ${r.eligibleCount} título(s) · concurrencia 8.`};}
  catch(error){refresh();return{ok:false,message:error?.message||'No se pudo iniciar el Batch PikoScore'}}
}
export async function pauseData003BatchAction(_prev,formData){try{const id=runId(formData);if(!id)throw new Error('Run ID ausente');await pauseBatch(id,{reason:'manual'});refresh();return{ok:true,message:'Pausa solicitada. Los títulos ya iniciados terminarán antes de detenerse.'}}catch(error){refresh();return{ok:false,message:error?.message||'No se pudo pausar el Batch'}}}
export async function resumeData003BatchAction(_prev,formData){try{const id=runId(formData);if(!id)throw new Error('Run ID ausente');await resumeBatch(id);refresh();return{ok:true,message:'Batch reanudado.'}}catch(error){refresh();return{ok:false,message:error?.message||'No se pudo reanudar el Batch'}}}
export async function cancelData003BatchAction(_prev,formData){try{const id=runId(formData);if(!id)throw new Error('Run ID ausente');await cancelBatch(id);refresh();return{ok:true,message:'Cancelación solicitada. El trabajo ya iniciado se conservará.'}}catch(error){refresh();return{ok:false,message:error?.message||'No se pudo cancelar el Batch'}}}
