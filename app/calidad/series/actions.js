'use server';
import {revalidatePath} from 'next/cache';
import {db} from '@/lib/db';
import {recomputeLifecycleForIds} from '@/lib/lifecycle';
import {refreshSeriesUnitary,refreshSeriesUnitaryCore} from '@/lib/series-unitary';
import {confirmSeriesEsAvailability} from '@/lib/series-es-availability';
import {syncPlexSeriesFast,syncPlexSeriesDetail} from '@/lib/series-plex-sync-safe';
import {rebuildSeriesQualityReadModel} from '@/lib/series-quality-query';
import {executeObservedProcess} from '@/lib/process-runtime';
const revalidate=(ratingKey,imdbId)=>{revalidatePath('/calidad');revalidatePath('/calidad/series');if(ratingKey)revalidatePath(`/calidad/series/${ratingKey}`);if(imdbId)revalidatePath(`/catalogo/${imdbId}`)};
async function runTracked(type,scope,fn){const sql=db();const[r]=await sql`INSERT INTO series_quality_runs(run_type,scope_key,status) VALUES(${type},${scope||null},'running') RETURNING id`;try{const out=await fn();await rebuildSeriesQualityReadModel(sql);await sql`UPDATE series_quality_runs SET status='success',finished_at=now(),processed_count=${Number(out.examined??out.episodes??1)},changed_count=${Number(out.changed??out.added??0)},summary=${JSON.stringify(out)}::jsonb WHERE id=${r.id}`;return out}catch(e){await sql`UPDATE series_quality_runs SET status='error',finished_at=now(),error_count=1,summary=${JSON.stringify({error:e?.message||String(e)})}::jsonb WHERE id=${r.id}`;throw e}}
export async function syncPlexSeriesFastAction(){try{const r=await runTracked('plex_fast',null,()=>syncPlexSeriesFast());revalidate();return{ok:true,message:`Plex: ${r.examined} series · ${r.changed} cambios · ${r.created} nuevas${r.partial?' · revisión parcial':''}`}}catch(e){return{ok:false,message:e?.message||'No se pudo sincronizar Plex'}}}
export async function syncPlexSeriesDetailAction(_previousState,formData){try{const ratingKey=String(formData.get('ratingKey')||'').trim();const r=await runTracked('plex_detail',ratingKey,()=>syncPlexSeriesDetail(ratingKey));revalidate(ratingKey);return{ok:true,message:`Plex actualizado: ${r.seasons} temporadas · ${r.episodes} episodios`}}catch(e){return{ok:false,message:e?.message||'No se pudo actualizar el detalle Plex'}}}
export async function refreshOneSeriesAction(_previousState,formData){try{const imdbId=String(formData.get('imdbId')||'').trim()||null,ratingKey=String(formData.get('ratingKey')||'').trim()||null;const r=await runTracked('tmdb_refresh',ratingKey||imdbId,()=>refreshSeriesUnitary({imdbId,ratingKey}));revalidate(r.ratingKey,r.imdbId);return{ok:true,message:`TMDb actualizado: ${r.seasons} temporadas · ${r.episodes} episodios`}}catch(e){return{ok:false,message:e?.message||'No se pudo actualizar TMDb'}}}
export async function confirmEsAvailabilityAction(_previousState,formData){try{const ratingKey=String(formData.get('ratingKey')||'').trim();const r=await runTracked('es_availability',ratingKey,()=>confirmSeriesEsAvailability({ratingKey}));revalidate(ratingKey);return{ok:true,message:r.examined?`España: ${r.examined} temporadas · ${r.available} confirmadas${r.watchmode?` (${r.watchmode} por Watchmode)`:''} · ${r.unknown} siguen por confirmar`:'No quedan temporadas por confirmar'}}catch(e){return{ok:false,message:e?.message||'No se pudo comprobar disponibilidad en España'}}}
export async function resetSeasonAvailabilityAction(formData){
  const ratingKey=String(formData.get('ratingKey')||'').trim(),season=Number(formData.get('season'));if(!ratingKey||!Number.isInteger(season)||season<1)throw new Error('Temporada inválida');
  const sql=db(),entityId=`${ratingKey}:S${season}`,requestKey=`PROC-SER-006:${entityId}:${Math.floor(Date.now()/3000)}`;
  const observed=await executeObservedProcess({processCode:'PROC-SER-006',runKind:'individual',triggerSource:'calidad_series_manual',executor:'vercel',entityType:'season',entityId,correlationKey:requestKey,idempotencyKey:requestKey,context:{surface:`/calidad/series/${ratingKey}`,operation:'reset_season_availability',rating_key:ratingKey,season}},async trace=>{
    const[s]=await sql`SELECT imdb_id FROM series_reference WHERE show_rating_key=${ratingKey} LIMIT 1`;if(!s?.imdb_id)throw Object.assign(new Error('Serie no encontrada'),{processStep:'load_season'});
    const[before]=await sql`SELECT status,source,confidence,manual_override,checked_at,note FROM series_season_availability WHERE show_rating_key=${ratingKey} AND season_number=${season} AND country_code='ES' LIMIT 1`;
    await trace.event({eventType:'manual_decision',step:'reset_manual_availability',entityType:'season',entityId,message:'Retirar corrección manual de disponibilidad',data:{season,previous_status:before?.status||null,previous_source:before?.source||null,manual_override:Boolean(before?.manual_override)}});
    await sql`UPDATE series_season_availability SET manual_override=false,status='UNKNOWN',source='manual_reset',confidence='unknown',checked_at=now(),note='Override manual retirado; pendiente de refresco automático' WHERE show_rating_key=${ratingKey} AND season_number=${season} AND country_code='ES'`;
    const refreshed=await refreshSeriesUnitaryCore({ratingKey,trace});
    await rebuildSeriesQualityReadModel(sql);
    const[after]=await sql`SELECT status,source,confidence,manual_override,checked_at,note FROM series_season_availability WHERE show_rating_key=${ratingKey} AND season_number=${season} AND country_code='ES' LIMIT 1`;
    return{technicalStatus:'succeeded',functionalResult:'reset_to_automatic',before:before||null,after:after||null,metrics:{seasons:refreshed.seasons,episodes:refreshed.episodes,overrides_reset:before?.manual_override?1:0},message:'Disponibilidad manual retirada y referencia automática refrescada',imdbId:s.imdb_id,ratingKey,season};
  });
  revalidate(ratingKey,observed.result?.imdbId);return observed.result;
}
export async function reviewSeriesExtraAction(formData){
  const ratingKey=String(formData.get('ratingKey')||'').trim(),season=Number(formData.get('season')),episode=Number(formData.get('episode')),decision=String(formData.get('decision')||'').trim(),userNote=String(formData.get('note')||'').trim().slice(0,300);
  if(!ratingKey||!Number.isInteger(season)||!Number.isInteger(episode)||season<0||episode<0)throw new Error('Episodio inválido');if(!['special','not_needed','reopen'].includes(decision))throw new Error('Decisión inválida');
  const sql=db(),entityId=`${ratingKey}:S${season}E${episode}`,requestKey=`PROC-SER-005:${entityId}:${decision}:${Math.floor(Date.now()/3000)}`;
  const observed=await executeObservedProcess({processCode:'PROC-SER-005',runKind:'individual',triggerSource:'calidad_series_manual',executor:'vercel',entityType:'episode',entityId,correlationKey:requestKey,idempotencyKey:requestKey,context:{surface:`/calidad/series/${ratingKey}`,operation:'review_series_extra',rating_key:ratingKey,season,episode,decision}},async trace=>{
    const[s]=await sql`SELECT imdb_id FROM series_reference WHERE show_rating_key=${ratingKey} LIMIT 1`;if(!s?.imdb_id)throw Object.assign(new Error('Serie no encontrada'),{processStep:'load_anomaly'});
    const[before]=await sql`SELECT decision,note,updated_at FROM series_episode_overrides WHERE show_rating_key=${ratingKey} AND season_number=${season} AND episode_number=${episode} LIMIT 1`;
    await trace.event({eventType:'manual_decision',step:'review_extra',entityType:'episode',entityId,message:decision==='reopen'?'Reabrir anomalía':decision==='special'?'Aceptar como especial / extra válido':'Ignorar anomalía',data:{decision,season,episode}});
    if(decision==='reopen')await sql`DELETE FROM series_episode_overrides WHERE show_rating_key=${ratingKey} AND season_number=${season} AND episode_number=${episode}`;
    else{
      const[p]=await sql`SELECT p.rating_key,p.plex_title,p.fingerprint,p.plex_updated_at FROM plex_items p LEFT JOIN series_reference_episodes r ON r.show_rating_key=${ratingKey} AND r.season_number=p.parent_index AND r.episode_number=p.item_index WHERE p.active AND p.item_type='episode' AND p.grandparent_rating_key=${ratingKey} AND p.parent_index=${season} AND p.item_index=${episode} AND r.show_rating_key IS NULL ORDER BY p.rating_key LIMIT 1`;
      if(!p)throw Object.assign(new Error('La anomalía ya no existe con la evidencia actual. Actualiza Plex/TMDb y revisa de nuevo.'),{processStep:'load_anomaly'});
      const evidence=JSON.stringify({ser005:1,plex_rating_key:String(p.rating_key),plex_fingerprint:String(p.fingerprint||''),plex_title:p.plex_title||null,plex_updated_at:p.plex_updated_at||null,note:userNote||null});
      await sql`INSERT INTO series_episode_overrides(show_rating_key,season_number,episode_number,decision,note,created_at,updated_at) VALUES(${ratingKey},${season},${episode},${decision},${evidence},now(),now()) ON CONFLICT(show_rating_key,season_number,episode_number) DO UPDATE SET decision=EXCLUDED.decision,note=EXCLUDED.note,updated_at=now()`;
    }
    await recomputeLifecycleForIds([s.imdb_id]);await rebuildSeriesQualityReadModel(sql);
    return{technicalStatus:'succeeded',functionalResult:decision==='reopen'?'reopened':'accepted',before:before?{decision:before.decision}:null,after:{decision:decision==='reopen'?null:decision,evidence_bound:decision!=='reopen'},metrics:{decisions:1},message:decision==='reopen'?'Anomalía reabierta':'Decisión manual guardada',imdbId:s.imdb_id};
  });
  revalidate(ratingKey,observed.result?.imdbId);return observed.result;
}
