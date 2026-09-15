'use server';
import {revalidatePath} from 'next/cache';
import {startPlexGlobalBatch} from '@/lib/plex-global-batch';

function refresh(){revalidatePath('/');revalidatePath('/novedades');revalidatePath('/catalogo');revalidatePath('/plex');revalidatePath('/calidad');revalidatePath('/admin');revalidatePath('/actividad')}

export async function syncPlexFromNews(_prevState,formData){
  const raw=String(formData?.get('reviewFrom')||'').trim();
  const reviewFrom=raw?`${raw}T00:00:00.000Z`:null;
  try{
    const queued=await startPlexGlobalBatch('PROC-NOV-009',{reviewFrom,triggerSource:'novedades_manual'});
    refresh();
    if(queued.continuation)return{ok:true,runId:queued.run?.run_id||null,message:'La actualización de Plex ya terminó y PikoFilm está preparando sus Novedades en Railway'};
    return{ok:true,runId:queued.run?.run_id||null,message:queued.reused?'La sincronización Plex global ya está en curso en Railway':'Sincronización Plex en cola; Railway la ejecutará sin mantener abierto este request'};
  }catch(error){
    refresh();
    return{ok:false,message:error?.message||'No se pudo poner en cola la sincronización Plex'};
  }
}
