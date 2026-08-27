'use server';
// PikoQuality technical snapshot controls are intentionally driven from the frontend.
import {revalidatePath} from 'next/cache';
import {db} from '@/lib/db';
import {analyzeMoviePikoQuality,PikoQualityPrerequisiteError} from '@/lib/pikoquality-unitary';
import {processC6Batch,C6_BATCH_SIZE} from '@/lib/pikoquality-c6-batch';
import {setTechnicalArmed,setTechnicalRequestedState} from '@/lib/plex-technical-control.mjs';

export async function analyzeOnePikoQualityAction(_prevState,formData){
  const imdbId=String(formData.get('imdbId')||'');
  try{
    const result=await analyzeMoviePikoQuality(imdbId);
    revalidatePath('/calidad/pikoquality');revalidatePath('/calidad/peliculas');revalidatePath('/catalogo');revalidatePath(`/catalogo/${imdbId}`);revalidatePath('/admin');
    return{success:true,code:'OK',message:`Analizado · PQ ${result.score}`,score:result.score,band:result.band,formulaVersion:result.formulaVersion};
  }catch(e){
    if(e instanceof PikoQualityPrerequisiteError)return{success:false,code:e.code,message:e.message};
    return{success:false,code:'UNEXPECTED',message:'No se pudo completar el análisis. Revisa el detalle técnico y vuelve a intentarlo.'};
  }
}

export async function runC6BatchChunkAction(){
  const result=await processC6Batch(C6_BATCH_SIZE);
  revalidatePath('/calidad/pikoquality');revalidatePath('/calidad/peliculas');revalidatePath('/catalogo');
  return result;
}

async function setTechnicalState(state){await setTechnicalRequestedState(db(),state);revalidatePath('/calidad/pikoquality')}
export async function startTechnicalSnapshotAction(){const sql=db();await setTechnicalArmed(sql,true);await setTechnicalRequestedState(sql,'running');revalidatePath('/calidad/pikoquality')}
export async function pauseTechnicalSnapshotAction(){await setTechnicalState('paused')}
export async function stopTechnicalSnapshotAction(){await setTechnicalState('stopped')}
