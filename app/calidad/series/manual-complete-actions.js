'use server';
import {revalidatePath} from 'next/cache';
import {db} from '@/lib/db';
import {recomputeLifecycleForIds} from '@/lib/lifecycle';
import {rebuildSeriesQualityReadModel} from '@/lib/series-quality-query';
import {executeObservedProcess} from '@/lib/process-runtime';

const refresh=(ratingKey,imdbId)=>{
  revalidatePath('/calidad');
  revalidatePath('/calidad/series');
  revalidatePath(`/calidad/series/${ratingKey}`);
  if(imdbId)revalidatePath(`/catalogo/${imdbId}`);
};

export async function setSeriesManualCompleteAction(formData){
  const ratingKey=String(formData.get('ratingKey')||'').trim();
  const mode=String(formData.get('mode')||'mark').trim();
  if(!ratingKey)throw new Error('Serie Plex inválida');
  if(!['mark','reopen'].includes(mode))throw new Error('Acción inválida');
  const sql=db(),requestKey=`PROC-SER-008:${ratingKey}:${mode}:${Math.floor(Date.now()/3000)}`;
  const observed=await executeObservedProcess({
    processCode:'PROC-SER-008',runKind:'individual',triggerSource:'calidad_series_manual',executor:'vercel',entityType:'series',entityId:ratingKey,
    correlationKey:requestKey,idempotencyKey:requestKey,
    context:{surface:`/calidad/series/${ratingKey}`,operation:'set_series_manual_complete',rating_key:ratingKey,mode}
  },async trace=>{
    const[s]=await sql`SELECT show_rating_key,imdb_id,title FROM series_reference WHERE show_rating_key=${ratingKey} LIMIT 1`;
    if(!s)throw Object.assign(new Error('Serie no encontrada'),{processStep:'load_series'});
    const[before]=await sql`SELECT decision,note,created_at,updated_at FROM series_quality_overrides WHERE show_rating_key=${ratingKey} LIMIT 1`;
    await trace.event({eventType:'manual_decision',step:mode==='mark'?'mark_series_complete':'reopen_series_quality',entityType:'series',entityId:ratingKey,message:mode==='mark'?'Marcar serie como cuadrada manualmente':'Retirar serie cuadrada manualmente',data:{title:s.title||null,previous_decision:before?.decision||null}});
    if(mode==='mark'){
      await sql`INSERT INTO series_quality_overrides(show_rating_key,decision,note,created_at,updated_at) VALUES(${ratingKey},'manual_complete','Serie cuadrada manualmente desde Calidad · Series',now(),now()) ON CONFLICT(show_rating_key) DO UPDATE SET decision='manual_complete',note=EXCLUDED.note,updated_at=now()`;
    }else{
      await sql`DELETE FROM series_quality_overrides WHERE show_rating_key=${ratingKey} AND decision='manual_complete'`;
    }
    if(s.imdb_id)await recomputeLifecycleForIds([s.imdb_id]);
    await rebuildSeriesQualityReadModel(sql);
    const[after]=await sql`SELECT decision,note,created_at,updated_at FROM series_quality_overrides WHERE show_rating_key=${ratingKey} LIMIT 1`;
    return{technicalStatus:'succeeded',functionalResult:mode==='mark'?'accepted_complete':'reopened',before:before||null,after:after||null,metrics:{series_overrides:mode==='mark'?1:0},message:mode==='mark'?'Serie marcada como cuadrada manualmente':'Serie devuelta al diagnóstico automático',imdbId:s.imdb_id||null,ratingKey};
  });
  refresh(ratingKey,observed.result?.imdbId);
  return observed.result;
}
