'use server';
import {revalidatePath} from 'next/cache';
import {startSeriesBatch} from '@/lib/series-batch';

export async function refreshCatalogSeriesProfilesAction(){
  try{
    const queued=await startSeriesBatch('PROC-SER-007',{triggerSource:'catalog_series_profile_manual'});
    revalidatePath('/catalogo');
    if(queued.empty)return{ok:true,message:'Las temporadas, episodios y señales de España ya están actualizados.'};
    if(queued.reused)return{ok:true,message:`Actualización ya en curso · ${Number(queued.eligibleCount||0).toLocaleString('es-ES')} series pendientes.`};
    return{ok:true,message:`Actualización en Railway · ${Number(queued.eligibleCount||0).toLocaleString('es-ES')} series en cola. Puedes seguir usando PikoFilm.`};
  }catch(error){return{ok:false,message:error?.message||'No se pudo iniciar la actualización de datos de series.'}}
}
