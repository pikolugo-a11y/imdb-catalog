'use server';
import {revalidatePath} from 'next/cache';
import {startMov001Batch} from '@/lib/mov001-batch';
import {pauseBatch,resumeBatch,cancelBatch} from '@/lib/batch-engine';

function refresh(){revalidatePath('/calidad/peliculas');revalidatePath('/calidad');revalidatePath('/admin')}
const runId=formData=>String(formData.get('runId')||'').trim();

export async function startMov001BatchAction(){try{const r=await startMov001Batch({concurrency:8});refresh();if(r.empty)return{ok:true,message:'No hay películas pendientes de validación física.'};return{ok:true,runId:r.run?.run_id||null,message:r.reused?'Ya existe un Batch MOV-001 activo; se muestra esa ejecución.':`Batch preparado · ${r.eligibleCount} película(s) · concurrencia 8.`}}catch(error){refresh();return{ok:false,message:error?.message||'No se pudo iniciar el Batch de películas'}}}
export async function pauseMov001BatchAction(_prev,formData){try{const id=runId(formData);if(!id)throw new Error('Run ID ausente');await pauseBatch(id,{reason:'manual'});refresh();return{ok:true,message:'Pausa solicitada. Las películas ya iniciadas terminarán.'}}catch(error){refresh();return{ok:false,message:error?.message||'No se pudo pausar el Batch'}}}
export async function resumeMov001BatchAction(_prev,formData){try{const id=runId(formData);if(!id)throw new Error('Run ID ausente');await resumeBatch(id);refresh();return{ok:true,message:'Batch reanudado.'}}catch(error){refresh();return{ok:false,message:error?.message||'No se pudo reanudar el Batch'}}}
export async function cancelMov001BatchAction(_prev,formData){try{const id=runId(formData);if(!id)throw new Error('Run ID ausente');await cancelBatch(id);refresh();return{ok:true,message:'Cancelación solicitada. Las validaciones ya iniciadas se conservarán.'}}catch(error){refresh();return{ok:false,message:error?.message||'No se pudo cancelar el Batch'}}}
