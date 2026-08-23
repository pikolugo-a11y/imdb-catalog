'use server';
import {revalidatePath} from 'next/cache';
import {refreshSeriesUnitary} from '@/lib/series-unitary';

export async function refreshOneSeriesAction(formData){
  try{
    const imdbId=String(formData.get('imdbId')||'').trim()||null;
    const ratingKey=String(formData.get('ratingKey')||'').trim()||null;
    const r=await refreshSeriesUnitary({imdbId,ratingKey});
    revalidatePath('/calidad');
    revalidatePath('/calidad/series');
    revalidatePath(`/calidad/series/${r.ratingKey}`);
    revalidatePath(`/catalogo/${r.imdbId}`);
    revalidatePath('/admin');
    return{ok:true,message:`Serie actualizada: ${r.seasons} temporadas · ${r.episodes} episodios`};
  }catch(e){
    return{ok:false,message:e?.message||'No se pudo actualizar la serie'};
  }
}
