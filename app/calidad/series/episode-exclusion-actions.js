'use server';

import {revalidatePath} from 'next/cache';
import {db} from '@/lib/db';
import {recomputeLifecycleForIds} from '@/lib/lifecycle';
import {rebuildSeriesQualityReadModelForRatingKey} from '@/lib/series-quality-read-model-core.mjs';
import {executeObservedProcess} from '@/lib/process-runtime';

const revalidate=(ratingKey,imdbId)=>{
  revalidatePath('/calidad');
  revalidatePath('/calidad/series');
  if(ratingKey)revalidatePath(`/calidad/series/${ratingKey}`);
  if(imdbId)revalidatePath(`/catalogo/${imdbId}`);
};

export async function reviewSeriesEpisodeExclusionAction(formData){
  const ratingKey=String(formData.get('ratingKey')||'').trim();
  const season=Number(formData.get('season'));
  const episode=Number(formData.get('episode'));
  const mode=String(formData.get('mode')||'exclude').trim();
  if(!ratingKey||!Number.isInteger(season)||!Number.isInteger(episode)||season<0||episode<0)throw new Error('Episodio inválido');
  if(!['exclude','reopen'].includes(mode))throw new Error('Acción inválida');

  const sql=db();
  const entityId=`${ratingKey}:S${season}E${episode}`;
  const requestKey=`PROC-SER-005:${entityId}:exclusion:${mode}:${Math.floor(Date.now()/3000)}`;
  const observed=await executeObservedProcess({
    processCode:'PROC-SER-005',runKind:'individual',triggerSource:'calidad_series_manual',executor:'vercel',
    entityType:'episode',entityId,correlationKey:requestKey,idempotencyKey:requestKey,
    context:{surface:`/calidad/series/${ratingKey}`,operation:'review_series_episode_exclusion',rating_key:ratingKey,season,episode,mode}
  },async trace=>{
    const[s]=await sql`SELECT imdb_id FROM series_reference WHERE show_rating_key=${ratingKey} LIMIT 1`;
    if(!s?.imdb_id)throw Object.assign(new Error('Serie no encontrada'),{processStep:'load_series'});
    const[reference]=await sql`SELECT name,air_date FROM series_reference_episodes WHERE show_rating_key=${ratingKey} AND season_number=${season} AND episode_number=${episode} LIMIT 1`;
    if(!reference)throw Object.assign(new Error('El episodio ya no existe en la referencia oficial. Actualiza TMDb y revisa de nuevo.'),{processStep:'load_episode'});
    const[diagnostic]=await sql`SELECT status,covered_by_rating_key FROM series_diagnostics WHERE show_rating_key=${ratingKey} AND season_number=${season} AND episode_number=${episode} LIMIT 1`;
    const[before]=await sql`SELECT decision,note,updated_at FROM series_episode_overrides WHERE show_rating_key=${ratingKey} AND season_number=${season} AND episode_number=${episode} LIMIT 1`;

    if(mode==='exclude'){
      if(diagnostic?.status!=='missing')throw Object.assign(new Error('Sólo se puede excluir un episodio oficial que actualmente falta en Plex.'),{processStep:'validate_episode'});
      await trace.event({eventType:'manual_decision',step:'exclude_official_episode',entityType:'episode',entityId,message:'Marcar episodio oficial como exclusión',data:{season,episode,previous_decision:before?.decision||null}});
      const evidence=JSON.stringify({ser005:1,manual_exclusion:1,reference_name:reference.name||null,reference_air_date:reference.air_date||null});
      await sql`INSERT INTO series_episode_overrides(show_rating_key,season_number,episode_number,decision,note,created_at,updated_at) VALUES(${ratingKey},${season},${episode},'unavailable',${evidence},now(),now()) ON CONFLICT(show_rating_key,season_number,episode_number) DO UPDATE SET decision='unavailable',note=EXCLUDED.note,updated_at=now()`;
    }else{
      if(before?.decision!=='unavailable')throw Object.assign(new Error('No existe una exclusión manual que retirar.'),{processStep:'validate_episode'});
      await trace.event({eventType:'manual_decision',step:'reopen_official_episode',entityType:'episode',entityId,message:'Retirar exclusión manual del episodio',data:{season,episode}});
      await sql`DELETE FROM series_episode_overrides WHERE show_rating_key=${ratingKey} AND season_number=${season} AND episode_number=${episode} AND decision='unavailable'`;
    }

    await recomputeLifecycleForIds([s.imdb_id]);
    await rebuildSeriesQualityReadModelForRatingKey(sql,ratingKey);
    return{
      technicalStatus:'succeeded',functionalResult:mode==='exclude'?'excluded':'reopened',
      before:before?{decision:before.decision}:null,after:{decision:mode==='exclude'?'unavailable':null},metrics:{decisions:1},
      message:mode==='exclude'?'Episodio marcado como exclusión':'Exclusión retirada',imdbId:s.imdb_id,ratingKey,season,episode
    };
  });
  revalidate(ratingKey,observed.result?.imdbId);
  return observed.result;
}
