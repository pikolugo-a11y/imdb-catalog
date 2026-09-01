'use server';
import {revalidatePath} from 'next/cache';
import {startIdentityValidationBatch} from '@/lib/identity-validation-batch';
import {pauseBatch,resumeBatch,cancelBatch} from '@/lib/batch-engine';
const refresh=()=>{revalidatePath('/calidad/validacion-identidad');revalidatePath('/admin')};
const limitOf=formData=>{const raw=String(formData.get('limit')||'').trim();return raw?Number(raw):null};
export async function startIv001BatchAction(formData){const r=await startIdentityValidationBatch('PROC-IV-001',{concurrency:2,limit:limitOf(formData)});refresh();return r}
export async function startIv002BatchAction(formData){const r=await startIdentityValidationBatch('PROC-IV-002',{concurrency:8,limit:limitOf(formData)});refresh();return r}
export async function pauseValidationBatchAction(formData){await pauseBatch(String(formData.get('runId')||''),{reason:'manual'});refresh()}
export async function resumeValidationBatchAction(formData){await resumeBatch(String(formData.get('runId')||''));refresh()}
export async function cancelValidationBatchAction(formData){await cancelBatch(String(formData.get('runId')||''));refresh()}
