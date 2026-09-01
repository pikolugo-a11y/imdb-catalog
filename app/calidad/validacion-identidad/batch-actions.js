'use server';
import {revalidatePath} from 'next/cache';
import {startIvBatch} from '@/lib/iv-batch';
import {pauseBatch,resumeBatch,cancelBatch} from '@/lib/batch-engine';
const refresh=()=>{revalidatePath('/calidad/validacion-identidad');revalidatePath('/admin')};
const limitFrom=formData=>{const raw=String(formData.get('limit')||'').trim();return raw?Number(raw):null};
export async function startIv001BatchAction(formData){const r=await startIvBatch('PROC-IV-001',{limit:limitFrom(formData)});refresh();return r}
export async function startIv002BatchAction(formData){const r=await startIvBatch('PROC-IV-002',{limit:limitFrom(formData)});refresh();return r}
export async function pauseIvBatchAction(formData){await pauseBatch(String(formData.get('runId')||''),{reason:'manual'});refresh()}
export async function resumeIvBatchAction(formData){await resumeBatch(String(formData.get('runId')||''));refresh()}
export async function cancelIvBatchAction(formData){await cancelBatch(String(formData.get('runId')||''));refresh()}
