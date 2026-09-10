'use server';
import {revalidatePath} from 'next/cache';
import {refreshSagaCollectionUnitary} from '@/lib/saga-unitary';
import {startSagaFullRefreshBatch,pauseSagaFullRefresh,resumeSagaFullRefresh,cancelSagaFullRefresh} from '@/lib/saga-batch';

function refresh(){revalidatePath('/sagas');revalidatePath('/admin');}
const runIdFrom=formData=>String(formData.get('runId')||'').trim();

export async function refreshAllSagasAction(){
  try{
    const r=await startSagaFullRefreshBatch();
    refresh();
    if(r.empty)return{ok:true,message:'No hay sagas para actualizar'};
    if(r.reused)return{ok:true,message:`Actualización completa ya activa · ${r.queued} pendientes`};
    return{ok:true,message:`Actualización completa en Railway iniciada · ${r.total} sagas en cola`};
  }catch(error){
    return{ok:false,message:error?.message||'No se pudo iniciar la actualización completa de sagas'};
  }
}

export async function pauseSagaFullRefreshAction(_prevState,formData){try{await pauseSagaFullRefresh(runIdFrom(formData));refresh();return{ok:true,message:'Actualización de Sagas pausada. Los items ya iniciados terminarán y no se reclamarán nuevos.'}}catch(error){refresh();return{ok:false,message:error?.message||'No se pudo pausar Sagas'}}}
export async function resumeSagaFullRefreshAction(_prevState,formData){try{await resumeSagaFullRefresh(runIdFrom(formData));refresh();return{ok:true,message:'Actualización de Sagas reanudada.'}}catch(error){refresh();return{ok:false,message:error?.message||'No se pudo reanudar Sagas'}}}
export async function cancelSagaFullRefreshAction(_prevState,formData){try{await cancelSagaFullRefresh(runIdFrom(formData));refresh();return{ok:true,message:'Actualización de Sagas cancelada. Las pendientes quedan canceladas.'}}catch(error){refresh();return{ok:false,message:error?.message||'No se pudo cancelar Sagas'}}}

export async function refreshSagaCollectionAction(_prevState,formData){
  try{
    const collectionId=String(formData.get('collectionId')||'').trim();
    if(!/^\d+$/.test(collectionId))throw new Error('TMDb collection ID inválido');
    const r=await refreshSagaCollectionUnitary(collectionId,{requestKey:`saga-refresh:${collectionId}:${Date.now()}`});
    revalidatePath('/sagas');
    revalidatePath(`/sagas/${collectionId}`);
    return{ok:true,message:`Saga actualizada: ${r.members||0} miembros · ${r.identity_corrections||0} identidades corregidas`};
  }catch(error){
    return{ok:false,message:error?.message||'No se pudo actualizar esta saga'};
  }
}
