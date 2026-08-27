import 'server-only';
import {db} from './db';
import {scorePikoQualityC6,PIKOQUALITY_C6_VERSION} from './pikoquality-c6-core.mjs';
import {audit} from './runlog';
import {recomputeLifecycleForIds} from './lifecycle';

export class PikoQualityPrerequisiteError extends Error{
  constructor(code,message){super(message);this.name='PikoQualityPrerequisiteError';this.code=code;}
}

export async function analyzeMoviePikoQuality(imdbId){
  if(!/^tt\d+$/.test(String(imdbId||'')))throw new PikoQualityPrerequisiteError('INVALID_IMDB','IMDb ID inválido');
  const sql=db();
  const[row]=await sql`
    SELECT p.rating_key,p.fingerprint,p.item_type,p.plex_year,
      m.resolution,m.width,m.height,m.bitrate,m.video_codec,m.video_profile,m.video_frame_rate,m.audio_codec,m.audio_profile,m.audio_channels,m.container,
      f.file_size_bytes,f.duration_ms,
      ts.snapshot_status,ts.technical_fingerprint,
      vs.bitrate video_bitrate,vs.bit_depth,vs.dynamic_range,
      aus.codec audio_codec_stream,aus.profile audio_profile_stream,aus.bitrate audio_bitrate,aus.channels audio_channels_stream
    FROM plex_items p
    JOIN plex_external_ids x ON x.rating_key=p.rating_key AND x.provider='imdb' AND x.external_id=${imdbId}
    JOIN plex_media m ON m.rating_key=p.rating_key AND m.media_index=0
    LEFT JOIN plex_files f ON f.rating_key=p.rating_key AND f.media_index=0 AND f.part_index=0
    LEFT JOIN plex_technical_state ts ON ts.rating_key=p.rating_key
    LEFT JOIN LATERAL(SELECT bitrate,bit_depth,dynamic_range FROM plex_streams s WHERE s.rating_key=p.rating_key AND s.stream_type=1 ORDER BY s.bitrate DESC NULLS LAST,s.stream_index LIMIT 1) vs ON true
    LEFT JOIN LATERAL(SELECT codec,profile,bitrate,channels FROM plex_streams s WHERE s.rating_key=p.rating_key AND s.stream_type=2 ORDER BY s.channels DESC NULLS LAST,s.bitrate DESC NULLS LAST,s.stream_index LIMIT 1) aus ON true
    WHERE p.active AND p.item_type='movie'
    ORDER BY p.rating_key LIMIT 1`;
  if(!row)throw new PikoQualityPrerequisiteError('NO_ACTIVE_FILE','No hay archivo físico activo para esta película');
  if(row.snapshot_status!=='ready'||!row.technical_fingerprint)throw new PikoQualityPrerequisiteError('SNAPSHOT_PENDING','Los datos técnicos de este archivo todavía no están capturados. Espera a que la captura técnica lo procese o reanúdala desde esta pantalla.');
  const[v]=await sql`SELECT source_fingerprint,status FROM movie_file_validation WHERE rating_key=${row.rating_key}`;
  if(!v||v.status!=='checked'||v.source_fingerprint!==row.fingerprint)throw new PikoQualityPrerequisiteError('VALIDATION_REQUIRED','Primero debes validar el archivo de la película');

  await audit('pikoquality','title',imdbId,'unitary_analysis_started',{rating_key:row.rating_key,technical_fingerprint:row.technical_fingerprint,formula_version:PIKOQUALITY_C6_VERSION,source:'technical_snapshot'});
  try{
    const result=scorePikoQualityC6({...row,audio_codec:row.audio_codec_stream||row.audio_codec,audio_channels:row.audio_channels_stream||row.audio_channels});
    const score=result.scoreCompat,b=result.band;
    await sql`
      INSERT INTO piko_quality(rating_key,item_type,score,band,confidence,formula_version,status,components,source_fingerprint,enriched_at,last_error,evaluated_at,updated_at)
      VALUES(${row.rating_key},'movie',${score},${b},'high',${PIKOQUALITY_C6_VERSION},'evaluated',${JSON.stringify(result.components)}::jsonb,${row.technical_fingerprint},now(),NULL,now(),now())
      ON CONFLICT(rating_key) DO UPDATE SET item_type='movie',score=EXCLUDED.score,band=EXCLUDED.band,confidence='high',formula_version=EXCLUDED.formula_version,status='evaluated',components=EXCLUDED.components,source_fingerprint=EXCLUDED.source_fingerprint,enriched_at=now(),last_error=NULL,evaluated_at=now(),updated_at=now()`;
    const lifecycle=(await recomputeLifecycleForIds([imdbId])).get(imdbId);
    await audit('pikoquality','title',imdbId,'unitary_analysis_completed',{rating_key:row.rating_key,score,score10:result.score10,band:b,lifecycle:lifecycle?.state,formula_version:PIKOQUALITY_C6_VERSION,source:'technical_snapshot'});
    return{score,score10:result.score10,band:b,lifecycle,formulaVersion:PIKOQUALITY_C6_VERSION};
  }catch(e){
    await audit('pikoquality','title',imdbId,'unitary_analysis_failed',{rating_key:row.rating_key,error:e?.message||String(e),formula_version:PIKOQUALITY_C6_VERSION,source:'technical_snapshot'});
    throw e;
  }
}
