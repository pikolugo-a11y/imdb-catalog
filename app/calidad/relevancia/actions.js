'use server';
import {revalidatePath} from 'next/cache';
import {startPikoRelevanceBatch} from '@/lib/pikorelevancia-batch';

const refresh=()=>{revalidatePath('/calidad/relevancia');revalidatePath('/calidad');revalidatePath('/catalogo');};
export async function enqueuePikoRelevanceSelectionAction(_prev,formData){
  try{
    const single=String(formData.get('singleImdbId')||'').trim();
    const ids=single?[single]:formData.getAll('imdbId').map(x=>String(x||'').trim()).filter(Boolean);
    if(!ids.length)return{ok:false,message:'Selecciona al menos una serie.'};
    const r=await startPikoRelevanceBatch({entityIds:ids,triggerSource:'calidad_relevancia_manual'});
    refresh();
    if(r.empty)return{ok:true,message:'No había series válidas que encolar.'};
    if(r.reused)return{ok:true,message:r.appended?`${r.appended} serie(s) añadidas a la cola activa.`:'Las series seleccionadas ya estaban en la cola.'};
    return{ok:true,message:`PikoRelevancia encolada para ${r.eligibleCount} serie(s). Se procesarán de una en una.`};
  }catch(error){refresh();return{ok:false,message:error?.message||'No se pudo encolar PikoRelevancia'};}
}
