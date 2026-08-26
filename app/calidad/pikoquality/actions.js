'use server';
import {revalidatePath} from 'next/cache';
import {db} from '@/lib/db';
import {analyzeMoviePikoQuality} from '@/lib/pikoquality-unitary';
import {setTechnicalArmed,setTechnicalRequestedState} from '@/lib/plex-technical-control.mjs';

export async function analyzeOnePikoQualityAction(formData){
  const imdbId=String(formData.get('imdbId')||'');
  if(!/^tt\d+$/.test(imdbId))throw new Error('IMDb ID inválido');
  await analyzeMoviePikoQuality(imdbId);
  revalidatePath('/calidad/pikoquality');revalidatePath('/calidad/peliculas');revalidatePath('/catalogo');revalidatePath(`/catalogo/${imdbId}`);revalidatePath('/admin');
}

async function setTechnicalState(state){
  await setTechnicalRequestedState(db(),state);
  revalidatePath('/calidad/pikoquality');
}

export async function startTechnicalSnapshotAction(){
  const sql=db();
  await setTechnicalArmed(sql,true);
  await setTechnicalRequestedState(sql,'running');
  revalidatePath('/calidad/pikoquality');
}
export async function pauseTechnicalSnapshotAction(){await setTechnicalState('paused')}
export async function stopTechnicalSnapshotAction(){await setTechnicalState('stopped')}
