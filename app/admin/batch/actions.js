'use server';
import {revalidatePath} from 'next/cache';
import {createStageRun,setGlobalPause,setRunStatus,updateSourceLimit} from '@/lib/batch-control';

function refresh(){revalidatePath('/admin');revalidatePath('/admin/batch')}

export async function createBatchRunAction(formData){
  await createStageRun({stage:formData.get('stage'),limit:formData.get('limit'),requestedBy:'pikofilm-ui'});refresh();
}
export async function pauseBatchAction(formData){await setGlobalPause(true,String(formData.get('reason')||'Pausado por el usuario'));refresh()}
export async function resumeBatchAction(){await setGlobalPause(false,'');refresh()}
export async function pauseRunAction(formData){await setRunStatus(formData.get('runId'),'paused');refresh()}
export async function resumeRunAction(formData){await setRunStatus(formData.get('runId'),'queued');refresh()}
export async function cancelRunAction(formData){await setRunStatus(formData.get('runId'),'cancelled');refresh()}
export async function updateSourceLimitAction(formData){
  await updateSourceLimit({source:formData.get('source'),enabled:formData.get('enabled')==='on',maxConcurrency:formData.get('maxConcurrency'),minIntervalMs:formData.get('minIntervalMs'),dailyBudget:formData.get('dailyBudget')});refresh();
}
