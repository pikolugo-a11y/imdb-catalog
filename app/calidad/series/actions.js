'use server';
import {revalidatePath} from 'next/cache';
import {db} from '@/lib/db';
import {recomputeLifecycleForIds} from '@/lib/lifecycle';
import {refreshSeriesUnitary,refreshSeriesUnitaryCore} from '@/lib/series-unitary';
import {confirmSeriesEsAvailability} from '@/lib/series-es-availability';
import {markAllEpisodesSpainAvailable,setEpisodeSpainAvailability} from '@/lib/series-episode-availability';
import {startSeriesBatch} from '@/lib/series-batch';
import {rebuildSeriesDiagnostics} from '@/lib/series-diagnostics-core.mjs';
import {rebuildSeriesQualityReadModel} from '@/lib/series-quality-query';
import {executeObservedProcess} from '@/lib/process-runtime';
const revalidate=(ratingKey,imdbId)=>{revalidatePath('/calidad');revalidatePath('/calidad/series');if(ratingKey)revalidatePath(`/calidad/series/${ratingKey}`);if(imdbId)revalidatePath(`/catalogo/${imdbId}`)};
const parseCombinedEvidence=note=>{try{const x=JSON.parse(String(note||''));if(x?.manual_combined!==1&&x?.manual_double!==1)return null;const targets=Array.isArray(x.target_episodes)?x.target_episodes.map(Number).filter(Number.isInteger):[Number(x.target_episode)].filter(Number.isInteger);return{...x,target_episodes:targets,combined_size:[2,3].includes(Number(x.combined_size))?Number(x.combined_size):2}}catch{return null}};
async function runTracked(type,scope,fn){const sql=db();const[r]=await sql`INSERT INTO series_quality_runs(run_type,scope_key,status) VALUES(${type},${scope||null},'running') RETURNING id`;try{const out=await fn();await rebuildSeriesQualityReadModel(sql);await sql`UPDATE series_quality_runs SET status='success',finished_at=now(),processed_count=${Number(out.examined??out.episodes??1)},changed_count=${Number((out.changed??out.added??0)+(out.episodeCreated??0)+(out.episodeChanged??0)+(out.episodeMissing??0))},summary=${JSON.stringify(out)}::jsonb WHERE id=${r.id}`;return out}catch(e){await sql`UPDATE series_quality_runs SET status='error',finished_at=now(),error_count=1,summary=${JSON.stringify({error:e?.message||String(e)})}::jsonb WHERE id=${r.id}`;throw e}}
export async function syncPlexSeriesDetailAction(_previousState,formData){try{const ratingKey=String(formData.get('ratingKey')||'').trim();if(!ratingKey)throw new Error('Serie Plex inválida');const queued=await startSeriesBatch('PROC-SER-002',{triggerSource:'calidad_series_manual',entityIds:[ratingKey]});revalidate(ratingKey);return{ok:true,runId:queued.run?.run_id||null,message:queued.reused?(queued.appended?`Actualización Plex añadida a la ejecución en curso`:`La actualización Plex ya estaba incluida en la ejecución en curso`):'Actualización Plex en cola; Railway la procesará sin depender de este request'}}catch(e){return{ok:false,message:e?.message||'No se pudo poner en cola el detalle Plex'}}}
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
export async function setEpisodeSpainAvailabilityAction(formData){
  const ratingKey=String(formData.get('ratingKey')||'').trim(),season=Number(formData.get('season')),episode=Number(formData.get('episode')),status=String(formData.get('status')||'').trim();
  if(!ratingKey||!Number.isInteger(season)||season<0||!Number.isInteger(episode)||episode<1||!['available','not_yet_available'].includes(status))throw new Error('Disponibilidad de episodio inválida');
  const sql=db(),entityId=`${ratingKey}:S${season}E${episode}`,requestKey=`PROC-SER-008:${entityId}:${status}:${Math.floor(Date.now()/3000)}`;
  const observed=await executeObservedProcess({processCode:'PROC-SER-008',runKind:'individual',triggerSource:'calidad_series_manual',executor:'vercel',entityType:'episode',entityId,correlationKey:requestKey,idempotencyKey:requestKey,context:{surface:`/calidad/series/${ratingKey}`,operation:'set_episode_es_availability',rating_key:ratingKey,season,episode,status}},async trace=>{
    const result=await setEpisodeSpainAvailability(sql,{ratingKey,season,episode,status,note:status==='available'?'Marcado manualmente como emitido en España':'Marcado manualmente como no emitido en España'});
    await trace.event({eventType:'manual_decision',step:'set_episode_es_availability',entityType:'episode',entityId,message:status==='available'?'Marcar episodio como emitido en España':'Marcar episodio como no emitido en España',data:{season,episode,status,previous_status:result.before?.availability_status||null}});
    await recomputeLifecycleForIds([result.imdbId]);await rebuildSeriesQualityReadModel(sql);
    return{technicalStatus:'succeeded',functionalResult:status==='available'?'available_es':'not_available_es',before:result.before||null,after:{availability_status:status,source:'manual_ui'},metrics:{episodes:1},message:status==='available'?'Episodio marcado como emitido en España':'Episodio marcado como no emitido en España',imdbId:result.imdbId,ratingKey,season,episode};
  });
  revalidate(ratingKey,observed.result?.imdbId);return observed.result;
}

export async function markAllEpisodesSpainAvailableAction(formData){
  const ratingKey=String(formData.get('ratingKey')||'').trim();if(!ratingKey)throw new Error('Serie inválida');
  const sql=db(),requestKey=`PROC-SER-008:${ratingKey}:all_available:${Math.floor(Date.now()/3000)}`;
  const observed=await executeObservedProcess({processCode:'PROC-SER-008',runKind:'individual',triggerSource:'calidad_series_manual',executor:'vercel',entityType:'series',entityId:ratingKey,correlationKey:requestKey,idempotencyKey:requestKey,context:{surface:`/calidad/series/${ratingKey}`,operation:'mark_all_episode_es_available',rating_key:ratingKey}},async trace=>{
    const result=await markAllEpisodesSpainAvailable(sql,{ratingKey});
    await trace.event({eventType:'manual_decision',step:'mark_all_episode_es_available',entityType:'series',entityId:ratingKey,message:'Marcar todos los episodios oficiales como emitidos en España',data:{episodes:result.total,already_available:result.alreadyAvailable,overwritten_no:result.overwrittenNo}});
    await recomputeLifecycleForIds([result.imdbId]);await rebuildSeriesQualityReadModel(sql);
    return{technicalStatus:'succeeded',functionalResult:'all_available_es',before:{already_available:result.alreadyAvailable,explicit_no:result.overwrittenNo},after:{availability_status:'available',episodes:result.total},metrics:{episodes:result.total,overwritten_no:result.overwrittenNo},message:`${result.total} episodios marcados como emitidos en España`,imdbId:result.imdbId,ratingKey};
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
export async function reviewSeriesDoubleEpisodeAction(formData){
  const ratingKey=String(formData.get('ratingKey')||'').trim(),season=Number(formData.get('season')),episode=Number(formData.get('episode')),mode=String(formData.get('mode')||'mark').trim(),requestedSourceEpisode=Number(formData.get('sourceEpisode')||episode-1),combinedSize=Number(formData.get('combinedSize')||2);
  if(!ratingKey||!Number.isInteger(season)||!Number.isInteger(episode)||season<1||episode<1)throw new Error('Episodio inválido');if(!['mark','reopen'].includes(mode))throw new Error('Acción inválida');if(mode==='mark'&&(!Number.isInteger(requestedSourceEpisode)||requestedSourceEpisode<1||requestedSourceEpisode===episode))throw new Error('Capítulo origen inválido');if(mode==='mark'&&![2,3].includes(combinedSize))throw new Error('Tamaño de capítulo combinado inválido');
  const sql=db();let sourceEpisode=requestedSourceEpisode,targetEpisodes=mode==='mark'?Array.from({length:combinedSize-1},(_,i)=>episode+i):[episode],extending=false,existingTargets=[];
  if(mode==='mark'&&combinedSize===3&&episode>1){
    const[previousOverride]=await sql`SELECT episode_number,note FROM series_episode_overrides WHERE show_rating_key=${ratingKey} AND season_number=${season} AND episode_number=${episode-1} AND decision='manual_present' LIMIT 1`;
    const previousEvidence=parseCombinedEvidence(previousOverride?.note);
    const previousSource=Number(previousEvidence?.source_episode),previousTargets=(previousEvidence?.target_episodes||[]).map(Number).filter(Number.isInteger);
    if(previousEvidence&&Number.isInteger(previousSource)&&previousSource>0&&previousTargets.includes(episode-1)&&previousTargets.length===1){sourceEpisode=previousSource;existingTargets=previousTargets;targetEpisodes=[...new Set([...previousTargets,episode])].sort((a,b)=>a-b);extending=targetEpisodes.length===2;}
  }
  const entityId=`${ratingKey}:S${season}E${episode}`,requestKey=`PROC-SER-005:${entityId}:combined:${combinedSize}:${mode}:${sourceEpisode}:${Math.floor(Date.now()/3000)}`;
  const observed=await executeObservedProcess({processCode:'PROC-SER-005',runKind:'individual',triggerSource:'calidad_series_manual',executor:'vercel',entityType:'episode',entityId,correlationKey:requestKey,idempotencyKey:requestKey,context:{surface:`/calidad/series/${ratingKey}`,operation:'review_series_combined_episode',rating_key:ratingKey,season,episode,source_episode:sourceEpisode,combined_size:combinedSize,target_episodes:targetEpisodes,extension:extending,mode}},async trace=>{
    const[s]=await sql`SELECT imdb_id FROM series_reference WHERE show_rating_key=${ratingKey} LIMIT 1`;if(!s?.imdb_id)throw Object.assign(new Error('Serie no encontrada'),{processStep:'load_series'});
    const targets=await sql`SELECT episode_number,status FROM series_diagnostics WHERE show_rating_key=${ratingKey} AND season_number=${season} AND episode_number=ANY(${targetEpisodes}) ORDER BY episode_number`;
    if(mode==='mark'&&targets.length!==targetEpisodes.length)throw Object.assign(new Error('El capítulo combinado alcanza un episodio oficial que no existe'),{processStep:'load_target'});
    const beforeRows=await sql`SELECT episode_number,decision,note,updated_at FROM series_episode_overrides WHERE show_rating_key=${ratingKey} AND season_number=${season} AND episode_number=ANY(${targetEpisodes}) ORDER BY episode_number`;
    if(mode==='reopen'){
      const before=beforeRows.find(x=>Number(x.episode_number)===episode);if(before?.decision!=='manual_present')throw Object.assign(new Error('No existe una decisión de capítulo combinado que deshacer'),{processStep:'load_override'});
      let groupTargets=[episode];try{const ev=JSON.parse(String(before.note||''));if(Array.isArray(ev?.target_episodes)&&ev.target_episodes.length)groupTargets=ev.target_episodes.map(Number).filter(Number.isInteger)}catch{}
      await trace.event({eventType:'manual_decision',step:'reopen_combined_episode',entityType:'episode',entityId,message:'Deshacer capítulo combinado manual',data:{season,episode,target_episodes:groupTargets}});
      await sql`DELETE FROM series_episode_overrides WHERE show_rating_key=${ratingKey} AND season_number=${season} AND episode_number=ANY(${groupTargets}) AND decision='manual_present'`;
    }else{
      const existingSet=new Set(existingTargets.map(Number));
      if(targets.some(x=>existingSet.has(Number(x.episode_number))?x.status!=='covered_combined':x.status!=='missing'))throw Object.assign(new Error(extending?'No se puede ampliar el combinado porque cambió la cobertura de alguno de sus episodios. Actualiza la serie y revisa de nuevo.':'Alguno de los episodios ya no figura como faltante. Actualiza la serie y revisa de nuevo.'),{processStep:'load_target'});
      const[p]=await sql`SELECT rating_key,plex_title,fingerprint,plex_updated_at,parent_index season_number,item_index episode_number FROM plex_items WHERE active AND item_type='episode' AND grandparent_rating_key=${ratingKey} AND parent_index=${season} AND item_index=${sourceEpisode} ORDER BY rating_key LIMIT 1`;
      const label=combinedSize===3?'triple':'doble';
      if(!p)throw Object.assign(new Error(`No existe en Plex S${season}E${sourceEpisode} para usarlo como capítulo ${label}`),{processStep:'load_source'});
      await trace.event({eventType:'manual_decision',step:extending?'extend_combined_episode':'mark_combined_episode',entityType:'episode',entityId,message:extending?`Ampliar a capítulo triple: S${season}E${sourceEpisode} cubre ${targetEpisodes.map(x=>`S${season}E${x}`).join(' y ')}`:`Marcar capítulo ${label}: S${season}E${sourceEpisode} cubre ${targetEpisodes.map(x=>`S${season}E${x}`).join(' y ')}`,data:{season,episode,source_episode:sourceEpisode,combined_size:combinedSize,target_episodes:targetEpisodes,plex_rating_key:String(p.rating_key),extension:extending}});
      for(const targetEpisode of targetEpisodes){
        const evidence=JSON.stringify({manual_combined:1,manual_double:combinedSize===2?1:0,combined_size:combinedSize,plex_rating_key:String(p.rating_key),plex_fingerprint:String(p.fingerprint||''),plex_title:p.plex_title||null,plex_updated_at:p.plex_updated_at||null,source_season:season,source_episode:sourceEpisode,target_season:season,target_episode:targetEpisode,target_episodes:targetEpisodes});
        await sql`INSERT INTO series_episode_overrides(show_rating_key,season_number,episode_number,decision,note,created_at,updated_at) VALUES(${ratingKey},${season},${targetEpisode},'manual_present',${evidence},now(),now()) ON CONFLICT(show_rating_key,season_number,episode_number) DO UPDATE SET decision='manual_present',note=EXCLUDED.note,updated_at=now()`;
      }
    }
    await rebuildSeriesDiagnostics(sql,ratingKey);await recomputeLifecycleForIds([s.imdb_id]);await rebuildSeriesQualityReadModel(sql);
    const label=combinedSize===3?'triple':'doble';
    return{technicalStatus:'succeeded',functionalResult:mode==='reopen'?'reopened':'accepted',before:beforeRows.map(x=>({episode_number:Number(x.episode_number),decision:x.decision})),after:{decision:mode==='reopen'?null:'manual_present',source_episode:mode==='reopen'?null:sourceEpisode,combined_size:mode==='reopen'?null:combinedSize,target_episodes:mode==='reopen'?[]:targetEpisodes,extension:extending},metrics:{decisions:mode==='reopen'?beforeRows.length:targetEpisodes.length},message:mode==='reopen'?'Capítulo combinado deshecho':extending?`Capítulo triple: ${targetEpisodes.map(x=>`S${season}E${x}`).join(' y ')} incluidos en S${season}E${sourceEpisode}`:`Capítulo ${label}: ${targetEpisodes.map(x=>`S${season}E${x}`).join(' y ')} incluidos en S${season}E${sourceEpisode}`,imdbId:s.imdb_id};
  });
  revalidate(ratingKey,observed.result?.imdbId);return observed.result;
}