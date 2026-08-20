'use server';
import {revalidatePath} from 'next/cache';
import {analyzeMovieQuality} from '@/lib/quality-v2';
import {reanalyzeIdentity} from '@/lib/identity';
import {dispatchFullSeriesRefresh} from '@/lib/series-full-refresh-dispatch';
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
    const r=await dispatchFullSeriesRefresh('quality_dashboard');
    refreshQuality();
    if(!r.ok)return{ok:false,message:r.message||'No se pudo lanzar la actualización completa de Series'};
    if(r.alreadyRunning)return{ok:true,message:`Series ya se están actualizando: ${Number(r.processed||0).toLocaleString('es-ES')} / ${Number(r.total||0).toLocaleString('es-ES')} procesadas`};
    return{ok:true,message:`Actualización completa lanzada: ${Number(r.total||0).toLocaleString('es-ES')} series. Puedes seguir el progreso aquí y en Admin.`};
  }catch(e){
    await audit('quality','dashboard','series','refresh_dispatch_failed',{error:errorInfo(e)});
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
