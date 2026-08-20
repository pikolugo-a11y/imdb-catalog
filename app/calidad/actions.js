'use server';
import {revalidatePath} from 'next/cache';
import {analyzeMovieQuality} from '@/lib/quality-v2';
import {refreshSeriesV2} from '@/lib/series-v2';
import {reanalyzeIdentity} from '@/lib/identity';
import {audit,errorInfo} from '@/lib/runlog';

function refreshQuality(){
  revalidatePath('/calidad');
  revalidatePath('/calidad/peliculas');
  revalidatePath('/calidad/series');
  revalidatePath('/calidad/identidad');
  revalidatePath('/admin');
}

export async function refreshMoviesFromQuality(){
  try{
    const r=await analyzeMovieQuality();
    await audit('quality','dashboard','movies','refresh',{scanned:r.scanned,pending:r.pending,findings:r.findings,byType:r.byType||[]});
    refreshQuality();
    return{ok:true,message:`Películas actualizadas: ${r.scanned.toLocaleString('es-ES')} revisadas · ${r.pending} incidencias activas`};
  }catch(e){
    await audit('quality','dashboard','movies','refresh_failed',{error:errorInfo(e)});
    refreshQuality();
    return{ok:false,message:e?.message||'No se pudo actualizar Películas'};
  }
}

export async function refreshSeriesFromQuality(){
  try{
    const r=await refreshSeriesV2();
    await audit('quality','dashboard','series','refresh',{series:r.series,seasons:r.seasons,episodes:r.episodes,anomalies:r.anomalies,unmatchedEpisodes:r.unmatchedEpisodes,errors:r.errors});
    refreshQuality();
    return{ok:true,message:`Series actualizadas: ${r.series} revisadas · ${r.seasons} temporadas · ${r.anomalies??0} anomalías · ${r.errors} errores`};
  }catch(e){
    await audit('quality','dashboard','series','refresh_failed',{error:errorInfo(e)});
    refreshQuality();
    return{ok:false,message:e?.message||'No se pudo actualizar Series'};
  }
}

export async function refreshIdentityFromQuality(){
  try{
    const r=await reanalyzeIdentity();
    await audit('quality','dashboard','identity','refresh',{processed:r.processed,fixed:r.fixed,errors:r.errors});
    refreshQuality();
    return{ok:true,message:`Identidad actualizada: ${r.fixed}/${r.processed} resueltas automáticamente · ${r.errors||0} errores`};
  }catch(e){
    await audit('quality','dashboard','identity','refresh_failed',{error:errorInfo(e)});
    refreshQuality();
    return{ok:false,message:e?.message||'No se pudo actualizar Identidad'};
  }
}
