'use server';
import {revalidatePath} from 'next/cache';
import {startSeriesBatch} from '@/lib/series-batch';

export async function syncPlexSeriesFastAction(){
  try{
    const queued=await startSeriesBatch('PROC-SER-001',{triggerSource:'calidad_series_manual'});
    revalidatePath('/calidad');
    revalidatePath('/calidad/series');
    return{ok:true,runId:queued.run?.run_id||null,message:queued.reused?'La sincronización Plex global ya está en curso en Railway':'Sincronización Plex en cola; Railway la ejecutará sin mantener abierto este request'};
  }catch(error){
    return{ok:false,message:error?.message||'No se pudo poner en cola la sincronización Plex'};
  }
}
