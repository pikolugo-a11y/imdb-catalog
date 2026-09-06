'use server';
import {revalidatePath} from 'next/cache';
import {refreshSagas} from '@/lib/sagas-v2';
import {startSagaFullRefreshBatch} from '@/lib/saga-batch';

export async function refreshAllSagasAction(){
  try{
    const r=await startSagaFullRefreshBatch();
    revalidatePath('/sagas');
    revalidatePath('/admin');
    if(r.empty)return{ok:true,message:'No hay sagas para actualizar'};
    if(r.reused)return{ok:true,message:`Actualización completa ya en curso · ${r.queued} pendientes`};
    return{ok:true,message:`Actualización completa en Railway iniciada · ${r.total} sagas en cola`};
  }catch(error){
    return{ok:false,message:error?.message||'No se pudo iniciar la actualización completa de sagas'};
  }
}

export async function refreshSagaCollectionAction(_prevState,formData){
  try{
    const collectionId=String(formData.get('collectionId')||'').trim();
    if(!/^\d+$/.test(collectionId))throw new Error('TMDb collection ID inválido');
    const r=await refreshSagas({collectionId,requestKey:`saga-refresh:${collectionId}:${Date.now()}`});
    revalidatePath('/sagas');
    revalidatePath(`/sagas/${collectionId}`);
    return{ok:true,message:`Saga actualizada: ${r.members} miembros · ${r.identity_corrections||0} identidades corregidas`};
  }catch(error){
    return{ok:false,message:error?.message||'No se pudo actualizar esta saga'};
  }
}
