import 'server-only';
import {db} from './db';
import {ensureQualitySchema,scoreMovie,band,QUALITY_VERSION} from './pikoquality';
import {audit} from './runlog';
import {recomputeLifecycleForIds} from './lifecycle';

export class PikoQualityPrerequisiteError extends Error{
  constructor(code,message){super(message);this.name='PikoQualityPrerequisiteError';this.code=code;}
}

export async function analyzeMoviePikoQuality(imdbId){
  if(!/^tt\d+$/.test(String(imdbId||'')))throw new PikoQualityPrerequisiteError('INVALID_IMDB','IMDb ID inválido');
  await ensureQualitySchema();
  const sql=db();
  const[row]=await sql`
    SELECT p.rating_key,p.fingerprint,p.item_type,m.resolution,m.width,m.height,m.bitrate,m.video_codec,m.video_profile,m.video_frame_rate,
      m.audio_codec,m.audio_profile,m.audio_channels,m.container,f.file_size_bytes,f.duration_ms,
      ts.snapshot_status,
      vs.bitrate video_stream_bitrate,vs.bit_depth,vs.dynamic_range,
      aus.codec audio_stream_codec,aus.profile audio_stream_profile,aus.bitrate audio_stream_bitrate,aus.channels audio_stream_channels
    FROM plex_items p
    JOIN plex_external_ids x ON x.rating_key=p.rating_key AND x.provider='imdb' AND x.external_id=${imdbId}
    JOIN plex_media m ON m.rating_key=p.rating_key AND m.media_index=0
    LEFT JOIN plex_files f ON f.rating_key=p.rating_key AND f.media_index=0 AND f.part_index=0
    LEFT JOIN plex_technical_state ts ON ts.rating_key=p.rating_key
    LEFT JOIN LATERAL(
      SELECT bitrate,bit_depth,dynamic_range
      FROM plex_streams s
      WHERE s.rating_key=p.rating_key AND s.stream_type=1
      ORDER BY s.bitrate DESC NULLS LAST,s.stream_index
      LIMIT 1
    ) vs ON true
    LEFT JOIN LATERAL(
      SELECT codec,profile,bitrate,channels
      FROM plex_streams s
      WHERE s.rating_key=p.rating_key AND s.stream_type=2
      ORDER BY s.channels DESC NULLS LAST,s.bitrate DESC NULLS LAST,s.stream_index
      LIMIT 1
    ) aus ON true
    WHERE p.active AND p.item_type='movie'
    ORDER BY p.rating_key
    LIMIT 1`;
  if(!row)throw new PikoQualityPrerequisiteError('NO_ACTIVE_FILE','No hay archivo físico activo para esta película');
  if(row.snapshot_status!=='ready')throw new PikoQualityPrerequisiteError('SNAPSHOT_PENDING','Los datos técnicos de este archivo todavía no están capturados. Espera a que la captura técnica lo procese o reanúdala desde esta pantalla.');
  const[v]=await sql`SELECT source_fingerprint,status FROM movie_file_validation WHERE rating_key=${row.rating_key}`;
  if(!v||v.status!=='checked'||v.source_fingerprint!==row.fingerprint)throw new PikoQualityPrerequisiteError('VALIDATION_REQUIRED','Primero debes validar el archivo de la película');

  await audit('pikoquality','title',imdbId,'unitary_analysis_started',{rating_key:row.rating_key,fingerprint:row.fingerprint,source:'technical_snapshot'});
  try{
    const score=scoreMovie(row),b=band(score);
    const streamCount=(await sql`SELECT count(*)::int n FROM plex_streams WHERE rating_key=${row.rating_key}`)[0]?.n||0;
    await sql`
      INSERT INTO piko_quality(rating_key,item_type,score,band,confidence,formula_version,status,source_fingerprint,enriched_at,last_error,evaluated_at,updated_at)
      VALUES(${row.rating_key},'movie',${score},${b},'high',${QUALITY_VERSION},'evaluated',${row.fingerprint},now(),NULL,now(),now())
      ON CONFLICT(rating_key) DO UPDATE SET item_type='movie',score=EXCLUDED.score,band=EXCLUDED.band,confidence='high',formula_version=EXCLUDED.formula_version,status='evaluated',source_fingerprint=EXCLUDED.source_fingerprint,enriched_at=now(),last_error=NULL,evaluated_at=now(),updated_at=now()`;
    const lifecycle=(await recomputeLifecycleForIds([imdbId])).get(imdbId);
    await audit('pikoquality','title',imdbId,'unitary_analysis_completed',{rating_key:row.rating_key,score,band:b,streams:Number(streamCount),lifecycle:lifecycle?.state,source:'technical_snapshot'});
    return{score,band:b,streams:Number(streamCount),lifecycle,formulaVersion:QUALITY_VERSION};
  }catch(e){
    await audit('pikoquality','title',imdbId,'unitary_analysis_failed',{rating_key:row.rating_key,error:e?.message||String(e),source:'technical_snapshot'});
    throw e;
  }
}
