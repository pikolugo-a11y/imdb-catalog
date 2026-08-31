import 'server-only';
import {db} from './db';
import {audit} from './runlog';
import {recomputeLifecycleForIds} from './lifecycle';
import {reconcileSeriesReferencesFromPlex} from './series-reference-reconcile';
import {rebuildSeriesDiagnostics} from './series-diagnostics-core.mjs';
import {nextReferenceCheck} from './series-quality-domain.mjs';
import {executeObservedProcess} from './process-runtime';
const API='https://api.themoviedb.org/3',today=()=>new Date().toISOString().slice(0,10),sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function tmdb(path,trace=null,attempt=0){const token=process.env.TMDB_API_TOKEN;if(!token)throw new Error('TMDB_API_TOKEN no configurado');trace?.externalCall?.(1);const r=await fetch(`${API}${path}`,{headers:{Authorization:`Bearer ${token}`,Accept:'application/json'},cache:'no-store'});if(r.ok)return r.json();if((r.status===429||r.status>=500)&&attempt<3){await trace?.event?.({eventType:'retry',step:'tmdb_request',message:`TMDb ${r.status}; reintento ${attempt+1}`,data:{status:r.status,attempt:attempt+1}});await sleep(Number(r.headers.get('retry-after')||0)*1000||500*(2**attempt));return tmdb(path,trace,attempt+1)}const e=new Error(`TMDb respondió ${r.status}`);e.source='tmdb';e.retryable=r.status===429||r.status>=500;throw e}

export async function refreshSeriesUnitaryCore({imdbId=null,ratingKey=null,trace=null}={}){
  if(!imdbId&&!ratingKey)throw new Error('Falta identificar la serie');
  const sql=db();
  await trace?.event?.({eventType:'step_started',step:'reconcile_reference',message:'Reconciliando referencia de serie desde Plex'});
  await reconcileSeriesReferencesFromPlex(sql);
  await trace?.event?.({eventType:'step_completed',step:'reconcile_reference',message:'Referencia Plex reconciliada'});
  const[s]=ratingKey?await sql`SELECT r.show_rating_key,r.imdb_id,r.tmdb_id FROM series_reference r JOIN identity_validation iv ON iv.imdb_id=r.imdb_id AND iv.validation_status='valid' LEFT JOIN catalog_exclusions ex ON ex.imdb_id=r.imdb_id WHERE r.show_rating_key=${String(ratingKey)} AND ex.imdb_id IS NULL LIMIT 1`:await sql`SELECT r.show_rating_key,r.imdb_id,r.tmdb_id FROM series_reference r JOIN identity_validation iv ON iv.imdb_id=r.imdb_id AND iv.validation_status='valid' LEFT JOIN catalog_exclusions ex ON ex.imdb_id=r.imdb_id WHERE r.imdb_id=${String(imdbId)} AND ex.imdb_id IS NULL LIMIT 1`;
  if(!s)throw new Error('La serie no está preparada para esta fase');if(!s.tmdb_id)throw new Error('La serie no tiene TMDb ID');
  await audit('quality','series',s.imdb_id,'unitary_refresh_started',{rating_key:s.show_rating_key,tmdb_id:s.tmdb_id});
  try{
    await trace?.event?.({eventType:'step_started',step:'tmdb_series',message:'Consultando referencia principal en TMDb',data:{tmdb_id:s.tmdb_id}});
    const d=await tmdb(`/tv/${s.tmdb_id}?language=es-ES&append_to_response=watch/providers`,trace),providers=d['watch/providers']?.results?.ES,hasEs=Boolean(providers&&(providers.flatrate?.length||providers.buy?.length||providers.rent?.length||providers.free?.length||providers.ads?.length)),seasons=(d.seasons||[]).filter(x=>x.season_number>0),episodes=[];
    await trace?.event?.({eventType:'step_completed',step:'tmdb_series',message:`TMDb devolvió ${seasons.length} temporadas`,data:{seasons:seasons.length,status:d.status||null}});
    for(const season of seasons){
      await trace?.event?.({eventType:'step_started',step:'tmdb_season',entityType:'season',entityId:`${s.show_rating_key}:${season.season_number}`,message:`Consultando temporada ${season.season_number}`});
      const sd=await tmdb(`/tv/${s.tmdb_id}/season/${season.season_number}?language=es-ES`,trace),arr=sd.episodes||[],air=arr.map(x=>x.air_date).filter(Boolean).sort();let status='UNKNOWN',confidence='unknown';if(air.length&&air[0]>today()){status='ES_NOT_YET';confidence='high'}const note=status==='ES_NOT_YET'?'Temporada todavía no estrenada':hasEs?'Proveedor ES detectado para la serie, pero no demuestra disponibilidad de esta temporada':'Sin evidencia suficiente de distribución ES de esta temporada';
      await sql`INSERT INTO series_season_availability(show_rating_key,season_number,country_code,status,available_from,source,confidence,manual_override,checked_at,note) VALUES(${s.show_rating_key},${season.season_number},'ES',${status},${air[0]||null},'tmdb_watch_providers',${confidence},false,now(),${note}) ON CONFLICT(show_rating_key,season_number,country_code) DO UPDATE SET status=CASE WHEN series_season_availability.manual_override OR series_season_availability.status='PLEX_COMPLETE' OR (series_season_availability.status IN('ES_AVAILABLE','ES_PARTIAL') AND series_season_availability.source IN('tmdb_season_watch_providers','watchmode_episode_witness_es')) THEN series_season_availability.status ELSE EXCLUDED.status END,available_from=CASE WHEN series_season_availability.manual_override OR series_season_availability.status='PLEX_COMPLETE' OR (series_season_availability.status IN('ES_AVAILABLE','ES_PARTIAL') AND series_season_availability.source IN('tmdb_season_watch_providers','watchmode_episode_witness_es')) THEN series_season_availability.available_from ELSE EXCLUDED.available_from END,source=CASE WHEN series_season_availability.manual_override OR series_season_availability.status='PLEX_COMPLETE' OR (series_season_availability.status IN('ES_AVAILABLE','ES_PARTIAL') AND series_season_availability.source IN('tmdb_season_watch_providers','watchmode_episode_witness_es')) THEN series_season_availability.source ELSE EXCLUDED.source END,confidence=CASE WHEN series_season_availability.manual_override OR series_season_availability.status='PLEX_COMPLETE' OR (series_season_availability.status IN('ES_AVAILABLE','ES_PARTIAL') AND series_season_availability.source IN('tmdb_season_watch_providers','watchmode_episode_witness_es')) THEN series_season_availability.confidence ELSE EXCLUDED.confidence END,checked_at=now(),note=CASE WHEN series_season_availability.manual_override OR series_season_availability.status='PLEX_COMPLETE' OR (series_season_availability.status IN('ES_AVAILABLE','ES_PARTIAL') AND series_season_availability.source IN('tmdb_season_watch_providers','watchmode_episode_witness_es')) THEN series_season_availability.note ELSE EXCLUDED.note END`;
      for(const e of arr)episodes.push({show_rating_key:s.show_rating_key,season_number:season.season_number,episode_number:e.episode_number,tmdb_episode_id:String(e.id),name:e.name||null,overview:e.overview||null,air_date:e.air_date||null,runtime_minutes:e.runtime||null});
      await trace?.event?.({eventType:'step_completed',step:'tmdb_season',entityType:'season',entityId:`${s.show_rating_key}:${season.season_number}`,message:`Temporada ${season.season_number}: ${arr.length} episodios`,data:{episodes:arr.length,status}});
    }
    await trace?.event?.({eventType:'step_started',step:'persist_reference',message:'Reconstruyendo referencia oficial de episodios'});
    await sql`DELETE FROM series_reference_episodes WHERE show_rating_key=${s.show_rating_key}`;
    for(let i=0;i<episodes.length;i+=200){const payload=JSON.stringify(episodes.slice(i,i+200));await sql`INSERT INTO series_reference_episodes(show_rating_key,season_number,episode_number,tmdb_episode_id,name,overview,air_date,runtime_minutes) SELECT x.show_rating_key,x.season_number,x.episode_number,x.tmdb_episode_id,x.name,x.overview,x.air_date::date,x.runtime_minutes FROM jsonb_to_recordset(${payload}::jsonb) AS x(show_rating_key text,season_number int,episode_number int,tmdb_episode_id text,name text,overview text,air_date text,runtime_minutes int)`}
    const tmdbStatus=d.status||null,firstAir=d.first_air_date||null,lastAir=d.last_air_date||d.last_episode_to_air?.air_date||null,nextAir=d.next_episode_to_air?.air_date||null,next=nextReferenceCheck({status:tmdbStatus,lastAirDate:lastAir,nextAirDate:nextAir,refreshedAt:new Date()});
    await sql`UPDATE series_reference SET title=COALESCE(${d.name||null},title),original_title=COALESCE(${d.original_name||null},original_title),year=COALESCE(${Number(String(d.first_air_date||'').slice(0,4))||null},year),official_seasons=${seasons.length},official_episodes=${Number(d.number_of_episodes||episodes.length||0)},reference_source='tmdb',tmdb_status=${tmdbStatus},first_air_date=${firstAir},last_air_date=${lastAir},next_air_date=${nextAir},refreshed_at=now(),next_check_at=${next.toISOString()},plex_invalidated_at=NULL,plex_invalid_reason=NULL WHERE show_rating_key=${s.show_rating_key}`;
    await trace?.event?.({eventType:'step_completed',step:'persist_reference',message:`Referencia reconstruida: ${episodes.length} episodios`,data:{episodes:episodes.length,next_check_at:next.toISOString()}});
    await trace?.event?.({eventType:'step_started',step:'diagnostics',message:'Reconstruyendo diagnósticos de serie'});
    const diagnostics=await rebuildSeriesDiagnostics(sql,s.show_rating_key);
    await trace?.event?.({eventType:'step_completed',step:'diagnostics',message:'Diagnósticos reconstruidos',data:{official:diagnostics?.official||0,matched:diagnostics?.matched||0,combined:diagnostics?.combined||0}});
    await trace?.event?.({eventType:'step_started',step:'lifecycle',message:'Recalculando Lifecycle'});
    const lifecycle=(await recomputeLifecycleForIds([s.imdb_id])).get(s.imdb_id);
    await trace?.event?.({eventType:'step_completed',step:'lifecycle',message:`Lifecycle: ${lifecycle?.state||'sin estado'}`,data:{state:lifecycle?.state||null}});
    await audit('quality','series',s.imdb_id,'unitary_refresh_completed',{rating_key:s.show_rating_key,seasons:seasons.length,episodes:episodes.length,tmdb_status:tmdbStatus,first_air_date:firstAir,last_air_date:lastAir,next_air_date:nextAir,next_check_at:next.toISOString(),diagnostics,lifecycle:lifecycle?.state});
    return{ok:true,imdbId:s.imdb_id,ratingKey:s.show_rating_key,seasons:seasons.length,episodes:episodes.length,tmdbStatus,nextCheckAt:next.toISOString(),diagnostics,lifecycle};
  }catch(e){await audit('quality','series',s.imdb_id,'unitary_refresh_failed',{rating_key:s.show_rating_key,error:e?.message||String(e)});throw e}
}

export async function refreshSeriesUnitary({imdbId=null,ratingKey=null}={}){
  const entityId=String(imdbId||ratingKey||'').trim();if(!entityId)throw new Error('Falta identificar la serie');const requestKey=`PROC-SER-003:manual:${entityId}:${Math.floor(Date.now()/5000)}`;
  const observed=await executeObservedProcess({processCode:'PROC-SER-003',runKind:'individual',triggerSource:'calidad_series_manual',executor:'vercel',entityType:'series',entityId,correlationKey:requestKey,idempotencyKey:requestKey,context:{surface:'/calidad/series',operation:'refresh_series_tmdb_reference'}},async trace=>{
    const result=await refreshSeriesUnitaryCore({imdbId,ratingKey,trace});
    return{technicalStatus:'succeeded',functionalResult:'updated',metrics:{seasons:result.seasons,episodes:result.episodes},after:{imdb_id:result.imdbId,rating_key:result.ratingKey,tmdb_status:result.tmdbStatus,next_check_at:result.nextCheckAt,lifecycle:result.lifecycle?.state||null},message:'Referencia TMDb de serie actualizada',...result};
  });
  if(observed.reused)return{ok:true,reused:true,runId:observed.runId,imdbId,ratingKey,seasons:0,episodes:0};
  return{...observed.result,reused:false,runId:observed.runId};
}
