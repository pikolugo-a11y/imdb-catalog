'use server';
import {revalidatePath} from 'next/cache';
import {updateBatchApiSource,closeBatchApiBreaker} from '@/lib/batch-api-admin';
export async function updateBatchApiSourceAction(formData){const source=String(formData.get('source')||'').trim().toLowerCase();await updateBatchApiSource(source,{dailyLimit:formData.get('dailyLimit'),batchSharePercent:formData.get('batchSharePercent'),maxConcurrency:formData.get('maxConcurrency')});revalidatePath('/admin')}
export async function closeBatchApiBreakerAction(formData){await closeBatchApiBreaker(String(formData.get('source')||'').trim().toLowerCase());revalidatePath('/admin')}
