'use server';
import {revalidatePath} from 'next/cache';
import {refreshSagas} from '@/lib/sagas-v2';

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
