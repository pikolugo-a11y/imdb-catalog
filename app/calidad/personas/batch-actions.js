'use server';
import {revalidatePath} from 'next/cache';
import {startPeopleBatch} from '@/lib/people-batch';
import {pauseBatch,resumeBatch,cancelBatch} from '@/lib/batch-engine';
function refresh(){revalidatePath('/calidad/personas');revalidatePath('/calidad');revalidatePath('/admin')}
const runId=f=>String(f.get('runId')||'').trim();
const limitOf=f=>{const raw=String(f.get('limit')||'').trim();return raw?Number(raw):null};
export async function startPeopleBatchAction(formData){try{const r=await startPeopleBatch({limit:limitOf(formData),concurrency:2});refresh();return{ok:true,runId:r.run?.run_id||null,message:r.empty?'No hay personas pendientes.':r.reused?'Ya existe un Batch de Personas activo.':`Batch Personas preparado · ${r.eligibleCount} persona(s).`}}catch(error){refresh();return{ok:false,message:error?.message||'No se pudo iniciar el Batch de Personas'}}}
export async function pausePeopleBatchAction(formData){const id=runId(formData);if(!id)throw new Error('Run ID ausente');await pauseBatch(id,{reason:'manual'});refresh()}
export async function resumePeopleBatchAction(formData){const id=runId(formData);if(!id)throw new Error('Run ID ausente');await resumeBatch(id);refresh()}
export async function cancelPeopleBatchAction(formData){const id=runId(formData);if(!id)throw new Error('Run ID ausente');await cancelBatch(id);refresh()}
