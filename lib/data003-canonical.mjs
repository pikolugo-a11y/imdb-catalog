import {computePikoScoreV3,PIKOSCORE_V3_VERSION} from './pikoscore-v3-core.mjs';
import {dataComplete} from './lifecycle-data-stage.mjs';
import {PIKOQUALITY_LEGACY_VERSION} from './pikoquality-version.mjs';

const QUALITY_VERSION=PIKOQUALITY_LEGACY_VERSION;
const validId=id=>/^tt\d+$/.test(String(id||''));

function freshnessDays(row){
  let age=10;
  if(row?.release_date){const d=new Date(row.release_date);if(!Number.isNaN(d.getTime()))age=Math.max(0,(Date.now()-d.getTime())/(365.25*86400000));}
  else if(Number(row?.year)>1800)age=Math.max(0,new Date().getUTCFullYear()-Number(row.year));
  return age<0.25?14:age<1?30:age<3?90:age<10?180:365;
}
function pikoDue(row){
  if(String(row?.manual_rating_decision||'')==='fixed_five'&&Number(row?.final_rating)===5)return false;
  if(!row?.pikoscore_calculated_at||String(row?.pikoscore_version||'')!==PIKOSCORE_V3_VERSION)return true;
  const calc=new Date(row.pikoscore_calculated_at);if(Number.isNaN(calc.getTime()))return true;
  if(!row.ratings_refreshed_at)return true;
  const refreshed=new Date(row.ratings_refreshed_at);if(Number.isNaN(refreshed.getTime()))return true;
  if(refreshed>calc)return true;
  return Date.now()-refreshed.getTime()>=freshnessDays(row)*86400000;
}
function classify(r){
  if(r.excluded)return'EXCLUDED';
  if(!validId(r.imdb_id)||!r.tmdb_id)return'IDENTITY_PENDING';
  if(['doubtful','invalid'].includes(String(r.validation_status||'')))return'IDENTITY_REVIEW_REQUIRED';
  if(String(r.validation_status||'')!=='valid')return'IDENTITY_VALIDATION';
  if(!dataComplete(r))return'DATA_INCOMPLETE';
  if(pikoDue(r))return'PIKOSCORE_PENDING';
  const inPlex=String(r.plex_status||'')==='in_plex';
  if(!inPlex)return'COMPLETE';
  if(r.type==='Serie'||r.type==='Miniserie'){
    if(!r.has_series_reference)return'SERIES_SYNC_PENDING';
    if(Number(r.series_missing||0)>0||Number(r.series_extra||0)>0||Number(r.series_unknown||0)>0)return'SERIES_REVIEW';
    if(Number(r.pq_pending||0)>0)return'TECH_PENDING';
    return'COMPLETE';
  }
  if(!r.file_validation_current)return'MOVIE_FILE_PENDING';
  if(r.file_validation_issue)return'MOVIE_FILE_REVIEW';
  if(!r.pq_current)return'TECH_PENDING';
  return'COMPLETE';
}
function reason(r,state){
  if(state==='EXCLUDED')return'Título excluido';
  if(state==='IDENTITY_PENDING')return!validId(r.imdb_id)?'IMDb inválido o ausente':'Falta identidad: TMDb';
  if(state==='IDENTITY_REVIEW_REQUIRED')return`Validación de identidad: ${r.validation_status||'revisión'}`;
  if(state==='IDENTITY_VALIDATION')return'Identidad pendiente de validación';
  if(state==='DATA_INCOMPLETE')return'Ficha de datos incompleta';
  if(state==='PIKOSCORE_PENDING')return'Datos completos; ratings o PikoScore 3.0 pendientes/caducados';
  if(state==='MOVIE_FILE_PENDING')return'Archivo físico pendiente de validar';
  if(state==='MOVIE_FILE_REVIEW')return'Validación del archivo detectó una incidencia';
  if(state==='SERIES_SYNC_PENDING')return'Falta referencia oficial de serie';
  if(state==='SERIES_REVIEW')return'Serie con episodios o disponibilidad a revisar';
  if(state==='TECH_PENDING')return'PikoQuality pendiente para el archivo actual';
  return null;
}
async function lifecycleRow(sql,imdbId){
  const[r]=await sql`
 SELECT m.imdb_id,m.type,m.title_es,m.original_title,m.year,m.runtime,m.country,m.final_rating,m.tmdb_id,m.poster_path,mm.overview,mm.release_date,iv.validation_status,(ex.imdb_id IS NOT NULL) excluded,m.ratings_refreshed_at,m.pikoscore_calculated_at,m.pikoscore_version,m.pikoscore_confidence,
 COALESCE(m.source_status #>> '{data_quality_manual_data,decision}','') manual_data_decision,COALESCE(m.source_status #>> '{data_quality_manual_ratings,decision}','') manual_rating_decision,
 COALESCE((SELECT jsonb_agg(jsonb_build_object('source',tr.source,'rating',tr.normalized_rating,'votes',tr.votes,'fetched_at',tr.fetched_at,'expires_at',tr.expires_at,'status',tr.status)) FROM title_ratings tr WHERE tr.imdb_id=m.imdb_id),'[]'::jsonb) normalized_ratings,
 CASE WHEN pcs.status='in_plex' AND EXISTS(SELECT 1 FROM plex_items physical_check WHERE physical_check.rating_key=pcs.rating_key AND physical_check.active AND ((m.type='Película' AND physical_check.item_type='movie') OR (m.type IN('Serie','Miniserie') AND physical_check.item_type='show'))) THEN 'in_plex' WHEN pcs.status='in_plex' THEN 'missing' ELSE pcs.status END plex_status,
 pcs.rating_key,physical.fingerprint physical_fingerprint,pq.status pq_status,pq.formula_version pq_formula_version,pq.source_fingerprint pq_source_fingerprint,
 (mfv.rating_key IS NOT NULL AND mfv.status='checked' AND mfv.source_fingerprint=(SELECT md5(string_agg(lower(COALESCE(pfv.file_path,''))||'|'||COALESCE(pfv.file_size_bytes::text,'')||'|'||COALESCE(pfv.duration_ms::text,'')||'|'||COALESCE(pfv.plex_part_id,''),',' ORDER BY pfv.media_index,pfv.part_index)) FROM plex_files pfv WHERE pfv.rating_key=physical.rating_key AND COALESCE(pfv.exists_on_server,true)<>false)) file_validation_current,
 EXISTS(SELECT 1 FROM movie_quality_findings f WHERE f.imdb_id=m.imdb_id AND f.finding_type IN('duration','filename','duplicate') AND f.status IN('pending','waiting_sync')) file_validation_issue,(pq.status='evaluated' AND pq.formula_version=${QUALITY_VERSION} AND pq.source_fingerprint=physical.fingerprint) pq_current,
 COALESCE(m.source_status #>> '{data_quality_external_poster,url}','') external_poster_url,EXISTS(SELECT 1 FROM movie_genres g WHERE g.imdb_id=m.imdb_id) has_genres,EXISTS(SELECT 1 FROM series_reference sr WHERE sr.imdb_id=m.imdb_id) has_series_reference,
 COALESCE((SELECT count(*) FROM series_reference sr JOIN series_episode_effective_status e ON e.show_rating_key=sr.show_rating_key WHERE sr.imdb_id=m.imdb_id AND e.effective_status='missing_actionable'),0)::int series_missing,
 COALESCE((SELECT count(*) FROM series_reference sr JOIN series_episode_effective_status e ON e.show_rating_key=sr.show_rating_key WHERE sr.imdb_id=m.imdb_id AND e.effective_status='availability_unknown'),0)::int series_unknown,
 COALESCE((SELECT count(*) FROM series_reference sr JOIN plex_items p ON p.grandparent_rating_key=sr.show_rating_key AND p.active AND p.item_type='episode' LEFT JOIN series_reference_episodes re ON re.show_rating_key=sr.show_rating_key AND re.season_number=p.parent_index AND re.episode_number=p.item_index LEFT JOIN series_episode_overrides o ON o.show_rating_key=sr.show_rating_key AND o.season_number=p.parent_index AND o.episode_number=p.item_index WHERE sr.imdb_id=m.imdb_id AND re.show_rating_key IS NULL AND COALESCE(o.decision,'') NOT IN('special','not_needed') AND NOT EXISTS(SELECT 1 FROM series_diagnostics d WHERE d.show_rating_key=sr.show_rating_key AND p.rating_key=ANY(string_to_array(COALESCE(d.covered_by_rating_key,''),',')))),0)::int series_extra,
 COALESCE((SELECT count(*) FROM series_reference sr JOIN plex_items p ON p.grandparent_rating_key=sr.show_rating_key AND p.active AND p.item_type='episode' LEFT JOIN piko_quality q ON q.rating_key=p.rating_key AND q.status='evaluated' AND q.formula_version=${QUALITY_VERSION} AND q.source_fingerprint=p.fingerprint WHERE sr.imdb_id=m.imdb_id AND q.rating_key IS NULL),0)::int pq_pending
 FROM movies m LEFT JOIN movie_metadata mm USING(imdb_id) LEFT JOIN identity_validation iv USING(imdb_id) LEFT JOIN catalog_exclusions ex USING(imdb_id) LEFT JOIN plex_catalog_status pcs USING(imdb_id) LEFT JOIN plex_items physical ON physical.rating_key=pcs.rating_key AND physical.active LEFT JOIN movie_file_validation mfv ON mfv.rating_key=pcs.rating_key LEFT JOIN piko_quality pq ON pq.rating_key=pcs.rating_key WHERE m.imdb_id=${imdbId} LIMIT 1`;
  return r||null;
}
async function reconcileLifecycle(sql,imdbId){
  const row=await lifecycleRow(sql,imdbId);if(!row)throw new Error('Título no encontrado al reconciliar Lifecycle');
  const state=classify(row),blockingReason=reason(row,state);
  const[saved]=await sql`INSERT INTO catalog_lifecycle(imdb_id,lifecycle_state,previous_state,blocking_reason,state_changed_at,computed_at) VALUES(${imdbId},${state},NULL,${blockingReason},now(),now()) ON CONFLICT(imdb_id) DO UPDATE SET previous_state=CASE WHEN catalog_lifecycle.lifecycle_state<>EXCLUDED.lifecycle_state THEN catalog_lifecycle.lifecycle_state ELSE catalog_lifecycle.previous_state END,lifecycle_state=EXCLUDED.lifecycle_state,blocking_reason=EXCLUDED.blocking_reason,state_changed_at=CASE WHEN catalog_lifecycle.lifecycle_state<>EXCLUDED.lifecycle_state THEN now() ELSE catalog_lifecycle.state_changed_at END,computed_at=now() RETURNING lifecycle_state,blocking_reason`;
  return{state:saved.lifecycle_state,label:saved.lifecycle_state,blockingReason:saved.blocking_reason};
}

export async function executeData003Canonical(sql,imdbId,{trace=null}={}){
  if(!validId(imdbId))throw new Error('IMDb ID inválido');
  const[beforeRow]=await sql`SELECT m.imdb_id,m.title_es,m.original_title,m.country,m.year,m.final_rating,m.ratings_refreshed_at,m.pikoscore_calculated_at,m.pikoscore_version,m.pikoscore_confidence,mm.release_date FROM movies m LEFT JOIN movie_metadata mm USING(imdb_id) WHERE m.imdb_id=${imdbId} LIMIT 1`;
  if(!beforeRow)throw new Error('Título no encontrado');
  const ratings=await sql`SELECT source,normalized_rating,votes,status,provider FROM title_ratings WHERE imdb_id=${imdbId} ORDER BY source`;
  const before={score:beforeRow.final_rating==null?null:Number(beforeRow.final_rating),version:beforeRow.pikoscore_version||null,confidence:beforeRow.pikoscore_confidence==null?null:Number(beforeRow.pikoscore_confidence),ratings_refreshed_at:beforeRow.ratings_refreshed_at||null};
  await trace?.event?.({eventType:'step_started',step:'evaluate_pikoscore',message:'Evaluando ratings con el core canónico PikoScore 3.0'});
  const result=computePikoScoreV3({ratings,country:beforeRow.country,year:beforeRow.year,release_date:beforeRow.release_date});
  await trace?.event?.({eventType:'step_completed',step:'evaluate_pikoscore',message:'PikoScore evaluado',data:{version:result.version,score:result.score,confidence:result.confidence,source_count:result.sourceCount,family_count:result.familyCount,market:result.market}});
  await trace?.event?.({eventType:'step_started',step:'persist_pikoscore',message:'Guardando PikoScore canónico'});
  await sql`UPDATE movies SET final_rating=${result.score},pikoscore_calculated_at=now(),pikoscore_version=${PIKOSCORE_V3_VERSION},pikoscore_confidence=${result.confidence},synced_at=now() WHERE imdb_id=${imdbId}`;
  await sql`INSERT INTO admin_events(event_type,entity_type,entity_id,action,payload,created_at) VALUES('pikoscore','title',${imdbId},'calculated_v3',${JSON.stringify({version:PIKOSCORE_V3_VERSION,score:result.score,confidence:result.confidence,market:result.market,market_vote_scale:result.marketVoteScale,source_count:result.sourceCount,family_count:result.familyCount,family_coverage:result.familyCoverage,contributions:result.contributions,ratings_refreshed_at:beforeRow.ratings_refreshed_at||null,previous:{score:before.score,version:before.version,confidence:before.confidence}})}::jsonb,now())`;
  const lifecycle=await reconcileLifecycle(sql,imdbId);
  await trace?.event?.({eventType:'step_completed',step:'persist_pikoscore',message:'PikoScore guardado y Lifecycle recalculado',data:{lifecycle:lifecycle.state}});
  const changed=before.score!==result.score||before.version!==PIKOSCORE_V3_VERSION||before.confidence!==result.confidence;
  const after={score:result.score,version:PIKOSCORE_V3_VERSION,confidence:result.confidence,source_count:result.sourceCount,family_count:result.familyCount,market:result.market,lifecycle:lifecycle.state};
  return{...result,lifecycle,technicalStatus:'succeeded',functionalResult:changed?'updated':'no_change',before,after,metrics:{score:result.score,confidence:result.confidence,source_count:result.sourceCount,family_count:result.familyCount,family_coverage:result.familyCoverage,market:result.market},message:changed?'PikoScore recalculado y guardado':'PikoScore recalculado sin cambios funcionales'};
}
