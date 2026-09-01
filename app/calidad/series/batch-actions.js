'use server';
import {revalidatePath} from 'next/cache';
import {startSeriesBatch} from '@/lib/series-batch';
import {pauseBatch,resumeBatch,cancelBatch} from '@/lib/batch-engine';
const refresh=()=>{revalidatePath('/calidad/series');revalidatePath('/calidad');revalidatePath('/admin')},limitOf=f=>{const x=String(f.get('limit')||'').trim();return x?Number(x):null},id=f=>String(f.get('runId')||'').trim();
export async function startSer003BatchAction(formData){try{const r=await startSeriesBatch('PROC-SER-003',{limit:limitOf(formData)});refresh();return{ok:true,message:r.empty?'No hay referencias TMDb pendientes.':r.reused?'Ya existe SER-003 activo.':`SER-003 preparado · ${r.eligibleCount} serie(s).`}}catch(e){refresh();return{ok:false,message:e?.message||'No se pudo iniciar SER-003'}}}
export async function startSer004BatchAction(formData){try{const r=await startSeriesBatch('PROC-SER-004',{limit:limitOf(formData)});refresh();return{ok:true,message:r.empty?'No hay disponibilidad ES pendiente.':r.reused?'Ya existe SER-004 activo.':`SER-004 preparado · ${r.eligibleCount} serie(s).`}}catch(e){refresh();return{ok:false,message:e?.message||'No se pudo iniciar SER-004'}}}
export async function pauseSeriesBatchAction(formData){await pauseBatch(id(formData),{reason:'manual'});refresh()}
export async function resumeSeriesBatchAction(formData){await resumeBatch(id(formData));refresh()}
export async function cancelSeriesBatchAction(formData){await cancelBatch(id(formData));refresh()}
