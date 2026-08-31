import 'server-only';
import {db} from './db';
import {rebuildSeriesDiagnostics} from './series-diagnostics-core.mjs';
import {recomputeLifecycleForIds} from './lifecycle';
import {executeObservedProcess} from './process-runtime';

const API='https://api.themoviedb.org/3';
const WATCHMODE='https://api.watchmode.com/v1';
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function tmdb(path,attempt=0,trace=null){const token=process.env.TMDB_API_TOKEN;if(!token)throw Object.assign(new Error('TMDB_API_TOKEN no configurado'),{source:'tmdb',retryable:false});trace?.externalCall?.(1);const r=await fetch(`${API}${path}`,{headers:{Authorization:`Bearer ${token}`,Accept:'application/json'},cache:'no-store'});if(r.ok)return r.json();if((r.status===429||r.status>=500)&&attempt<3){trace?.retry?.(1);await sleep(Number(r.headers.get('retry-after')||0)*1000||500*(2**attempt));return tmdb(path,attempt+1,trace)}throw Object.assign(new Error(`TMDb respondió ${r.status}`),{source:'tmdb',retryable:r.status===429||r.status>=500,status:r.status})}
async function watchmode(path,attempt=0,trace=null){const key=process.env.WATCHMODE_API_KEY;if(!key)throw Object.assign(new Error('WATCHMODE_API_KEY no configurada en este deployment'),{source:'watchmode',retryable:false});const join=path.includes('?')?'&':'?';trace?.externalCall?.(1);const r=await fetch(`${WATCHMODE}${path}${join}apiKey=${encodeURIComponent(key)}`,{headers:{Accept:'application/json'},cache:'no-store'});if(r.ok)return r.json();if((r.status===429||r.status>=500)&&attempt<2){trace?.retry?.(1);await sleep(Number(r.headers.get('retry-after')||0)*1000||500*(2**attempt));return watchmode(path,attempt+1,trace)}let body='';try{body=(await r.text()).slice(0,200)}catch{}throw Object.assign(new Error(`Watchmode respondió ${r.status}${body?`: ${body}`:''}`),{source:'watchmode',retryable:r.status===429||r.status>=500,status:r.status})}
const hasOffers=p=>Boolean(p&&(p.flatrate?.length||p.free?.length||p.ads?.length||p.buy?.length||p.rent?.length));
const esSource=s=>String(s?.region||s?.country||s?.country_code||'').toUpperCase()==='ES';
const episodeSeason=e=>Number(e?.season_number??e?.season??e?.season_num);
const episodeNumber=e=>Number(e?.episode_number??e?.episode??e?.episode_num??e?.number);
const watchmodeTvId=tmdbId=>`tv-${Number(tmdbId)}`;
const episodeAvailableEs=e=>Array.isArray(e?.sources)&&e.sources.some(esSource);
async function watchmodeEpisodes(tmdbId,trace=null){const data=await watchmode(`/title/${watchmodeTvId(tmdbId)}/episodes/?regions=ES`,0,trace);return Array.isArray(data)?data:(data?.episodes||[])}
function watchmodeSeasonAvailable(episodes,season,{firstEpisode,lastEpisode}={}){const inSeason=episodes.filter(e=>episodeSeason(e)===Number(season));if(!inSeason.length)return false;const sorted=[...inSeason].sort((a,b)=>episodeNumber(a)-episodeNumber(b));const first=inSeason.find(e=>episodeNumber(e)===Number(firstEpisode))||sorted[0];if(!episodeAvailableEs(first))return false;const last=inSeason.find(e=>episodeNumber(e)===Number(lastEpisode))||sorted[sorted.length-1];if(last&&episodeNumber(last)!==episodeNumber(first)&&!episodeAvailableEs(last))return false;return true}

export async function confirmSeriesEsAvailabilityCore({ratingKey,trace=null}={}){
  const key=String(ratingKey||'').trim();if(!key)throw new Error('Falta identificar la serie');const sql=db();
  const[s]=await sql`SELECT show_rating_key,imdb_id,tmdb_id FROM series_reference WHERE show_rating_key=${key} LIMIT 1`;if(!s?.tmdb_id)throw new Error('La serie no tiene TMDb ID');
  const seasons=await sql`SELECT e.season_number,min(e.episode_number)::int AS first_episode,max(e.episode_number)::int AS last_episode FROM series_episode_effective_status e WHERE e.show_rating_key=${key} AND e.effective_status='availability_unknown' AND e.season_number>0 GROUP BY e.season_number ORDER BY e.season_number`;
  if(!seasons.length)return{examined:0,changed:0,available:0,unknown:0,watchmode:0,providerErrors:0,partial:false,imdbId:s.imdb_id,ratingKey:key};
  let changed=0,available=0,unknown=0,watchmodeResolved=0,providerErrors=0;let wmEpisodes=null,wmError=null;
  for(const row of seasons){const n=Number(row.season_number);await trace?.event?.({eventType:'step_started',step:'availability_season',entityType:'season',entityId:`${key}:S${n}`,message:`Comprobando disponibilidad ES de temporada ${n}`});
    const data=await tmdb(`/tv/${s.tmdb_id}/season/${n}/watch/providers`,0,trace),es=data?.results?.ES||null;
    if(hasOffers(es)){const result=await sql`UPDATE series_season_availability SET status='ES_AVAILABLE',source='tmdb_season_watch_providers',confidence='high',checked_at=now(),note='Disponibilidad ES confirmada a nivel de temporada por TMDb/JustWatch' WHERE show_rating_key=${key} AND season_number=${n} AND country_code='ES' AND manual_override=false RETURNING season_number`;if(result.length){changed++;available++}await trace?.event?.({eventType:'step_completed',step:'tmdb_season',entityType:'season',entityId:`${key}:S${n}`,message:'Disponibilidad ES confirmada por TMDb temporada',data:{resolved:true,source:'tmdb_season_watch_providers'}});continue}
    await trace?.event?.({eventType:'step_completed',step:'tmdb_season',entityType:'season',entityId:`${key}:S${n}`,message:'TMDb no aporta evidencia positiva para la temporada',data:{resolved:false,source:'tmdb_season_watch_providers'}});
    if(wmEpisodes===null&&!wmError){try{wmEpisodes=await watchmodeEpisodes(s.tmdb_id,trace)}catch(e){wmError=e}}
    if(wmError){providerErrors++;await trace?.event?.({eventType:'error',step:'watchmode',entityType:'season',entityId:`${key}:S${n}`,message:wmError?.message||'Error de Watchmode',data:{source:'watchmode',retryable:Boolean(wmError?.retryable)}});continue}
    const wm=watchmodeSeasonAvailable(wmEpisodes||[],n,{firstEpisode:row.first_episode,lastEpisode:row.last_episode});
    if(wm){const result=await sql`UPDATE series_season_availability SET status='ES_AVAILABLE',source='watchmode_episode_witness_es',confidence='high',checked_at=now(),note='Disponibilidad ES confirmada por primer y último episodio pendiente en Watchmode' WHERE show_rating_key=${key} AND season_number=${n} AND country_code='ES' AND manual_override=false RETURNING season_number`;if(result.length){changed++;available++;watchmodeResolved++}await trace?.event?.({eventType:'step_completed',step:'watchmode',entityType:'season',entityId:`${key}:S${n}`,message:'Disponibilidad ES confirmada por Watchmode',data:{resolved:true,source:'watchmode_episode_witness_es',first_episode:row.first_episode,last_episode:row.last_episode}})}
    else{await sql`UPDATE series_season_availability SET checked_at=now(),source=CASE WHEN manual_override THEN source ELSE 'tmdb_watchmode_es' END,note=CASE WHEN manual_override THEN note ELSE 'TMDb y Watchmode no aportan evidencia positiva suficiente de disponibilidad ES para esta temporada' END WHERE show_rating_key=${key} AND season_number=${n} AND country_code='ES'`;unknown++;await trace?.event?.({eventType:'step_completed',step:'watchmode',entityType:'season',entityId:`${key}:S${n}`,message:'Sin evidencia positiva suficiente; temporada permanece sin resolver',data:{resolved:false,source:'tmdb_watchmode_es'}})}
  }
  await trace?.event?.({eventType:'step_started',step:'recompute',message:'Reconstruyendo diagnósticos y Lifecycle'});const diagnostics=await rebuildSeriesDiagnostics(sql,key);const lifecycle=s.imdb_id?(await recomputeLifecycleForIds([s.imdb_id])).get(s.imdb_id):null;await trace?.event?.({eventType:'step_completed',step:'recompute',message:'Diagnósticos y Lifecycle actualizados',data:{lifecycle:lifecycle?.state||null}});
  return{examined:seasons.length,changed,available,unknown,watchmode:watchmodeResolved,providerErrors,partial:providerErrors>0,imdbId:s.imdb_id,ratingKey:key,diagnostics,lifecycle};
}

export async function confirmSeriesEsAvailability({ratingKey}={}){
  const key=String(ratingKey||'').trim(),bucket=Math.floor(Date.now()/5000),requestKey=`PROC-SER-004:${key}:manual:${bucket}`;
  const observed=await executeObservedProcess({processCode:'PROC-SER-004',runKind:'individual',triggerSource:'calidad_series_manual',executor:'vercel',entityType:'series',entityId:key||null,correlationKey:requestKey,idempotencyKey:requestKey,context:{surface:'/calidad/series',operation:'confirm_es_availability',rating_key:key}},async trace=>{const result=await confirmSeriesEsAvailabilityCore({ratingKey:key,trace});return{technicalStatus:result.partial?'partial':'succeeded',functionalResult:result.changed?'updated':result.examined?'no_change':'not_applicable',metrics:{examined:result.examined,changed:result.changed,available:result.available,unknown:result.unknown,watchmode:result.watchmode,provider_errors:result.providerErrors},after:{rating_key:key,partial:result.partial},message:result.partial?'Disponibilidad España comprobada parcialmente':'Disponibilidad España comprobada',...result}});
  if(observed.reused)return{examined:0,changed:0,available:0,unknown:0,watchmode:0,providerErrors:0,partial:false,reused:true,runId:observed.runId};
  return{...observed.result,reused:false,runId:observed.runId};
}
