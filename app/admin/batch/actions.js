'use server';
import {redirect} from 'next/navigation';
import {revalidatePath} from 'next/cache';
import {createStageRun,createEntityRun,setGlobalPause,setRunStatus,updateSourceLimit,setManualReview} from '@/lib/batch-control';

function refresh(){revalidatePath('/admin');revalidatePath('/admin/batch')}
function safeStage(v){return String(v||'IDENTITY_PENDING').replace(/[^A-Z_]/g,'')}
function safeRetry(v){return String(v||'new_only').replace(/[^a-z_]/g,'')}

export async function previewBatchRunAction(formData){
  const stage=safeStage(formData.get('stage')),retry=safeRetry(formData.get('retryMode')),limit=Math.max(1,Math.min(5000,Number(formData.get('limit')||100)));
  redirect(`/admin/batch?stage=${encodeURIComponent(stage)}&retry=${encodeURIComponent(retry)}&limit=${limit}#launch`);
}
export async function createBatchRunAction(formData){
  await createStageRun({stage:formData.get('stage'),limit:formData.get('limit'),retryMode:formData.get('retryMode'),requestedBy:'pikofilm-ui'});refresh();
}
export async function retryEntityAction(formData){
  await createEntityRun({stage:formData.get('stage'),entityId:formData.get('entityId'),requestedBy:'pikofilm-ui-force'});refresh();
}
export async function setManualReviewAction(formData){
  await setManualReview({stage:formData.get('stage'),entityId:formData.get('entityId'),enabled:formData.get('enabled')==='true',reason:formData.get('reason')});refresh();
}
export async function pauseBatchAction(formData){await setGlobalPause(true,String(formData.get('reason')||'Pausado por el usuario'));refresh()}
export async function resumeBatchAction(){await setGlobalPause(false,'');refresh()}
export async function pauseRunAction(formData){await setRunStatus(formData.get('runId'),'paused');refresh()}
export async function resumeRunAction(formData){await setRunStatus(formData.get('runId'),'queued');refresh()}
export async function cancelRunAction(formData){await setRunStatus(formData.get('runId'),'cancelled');refresh()}
export async function updateSourceLimitAction(formData){
  await updateSourceLimit({source:formData.get('source'),enabled:formData.get('enabled')==='on',maxConcurrency:formData.get('maxConcurrency'),minIntervalMs:formData.get('minIntervalMs'),dailyBudget:formData.get('dailyBudget')});refresh();
}
