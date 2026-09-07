'use server';
import {revalidatePath} from 'next/cache';
import {pauseAllGenericBatches,resumeAllGenericBatches,pauseBatch,resumeBatch,cancelBatch} from '@/lib/batch-engine';

function refresh(){revalidatePath('/admin');revalidatePath('/calidad/datos');revalidatePath('/sagas');}
const runId=formData=>String(formData.get('runId')||'').trim();
export async function pauseAllGenericBatchesAction(){try{await pauseAllGenericBatches({reason:'manual_global'});refresh();return{ok:true,message:'Pausa global activada. Los Batch terminarán sus items en curso y no reclamarán nuevos.'}}catch(error){refresh();return{ok:false,message:error?.message||'No se pudo pausar los Batch'}}}
export async function resumeAllGenericBatchesAction(){try{await resumeAllGenericBatches();refresh();return{ok:true,message:'Pausa global retirada. Los Batch activos pueden continuar.'}}catch(error){refresh();return{ok:false,message:error?.message||'No se pudo reactivar el motor Batch'}}}
export async function pauseBatchAction(_prevState,formData){try{await pauseBatch(runId(formData),{reason:'manual_run'});refresh();return{ok:true,message:'Batch pausado'}}catch(error){refresh();return{ok:false,message:error?.message||'No se pudo pausar el Batch'}}}
export async function resumeBatchAction(_prevState,formData){try{await resumeBatch(runId(formData));refresh();return{ok:true,message:'Batch reanudado'}}catch(error){refresh();return{ok:false,message:error?.message||'No se pudo reanudar el Batch'}}}
export async function cancelBatchAction(_prevState,formData){try{await cancelBatch(runId(formData));refresh();return{ok:true,message:'Batch cancelado'}}catch(error){refresh();return{ok:false,message:error?.message||'No se pudo cancelar el Batch'}}}
