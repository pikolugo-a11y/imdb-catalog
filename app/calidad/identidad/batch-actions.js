'use server';
import {revalidatePath} from 'next/cache';
import {startId001Batch} from '@/lib/id001-batch';
import {pauseBatch,resumeBatch,cancelBatch} from '@/lib/batch-engine';
const refresh=()=>{revalidatePath('/calidad/identidad');revalidatePath('/admin')};
export async function startId001BatchAction(formData){const limit=String(formData.get('limit')||'').trim();const r=await startId001Batch({concurrency:3,limit:limit?Number(limit):null});refresh();return r}
export async function pauseId001BatchAction(formData){await pauseBatch(String(formData.get('runId')||''),{reason:'manual'});refresh()}
export async function resumeId001BatchAction(formData){await resumeBatch(String(formData.get('runId')||''));refresh()}
export async function cancelId001BatchAction(formData){await cancelBatch(String(formData.get('runId')||''));refresh()}
