import {TECHNICAL_SNAPSHOT_VERSION,buildProbeFingerprint,buildTechnicalFingerprint,normalizeTechnicalSnapshot} from './plex-technical-core.mjs';

export async function ensureTechnicalStateForProbe(sql,item){
  const ratingKey=String(item?.ratingKey??'');
  if(!ratingKey)throw new Error('ratingKey requerido para technical probe');
  const probeFingerprint=buildProbeFingerprint(item);
  const sourceUpdatedAt=item?.updatedAt?new Date(Number(item.updatedAt)*1000).toISOString():null;
  const [current]=await sql`SELECT probe_fingerprint,technical_fingerprint,snapshot_status FROM plex_technical_state WHERE rating_key=${ratingKey}`;
  const changed=!current||current.probe_fingerprint!==probeFingerprint;
  if(!current){
    await sql`INSERT INTO plex_technical_state(rating_key,probe_fingerprint,snapshot_status,snapshot_version,needs_refresh,source_updated_at,last_probe_at,updated_at) VALUES(${ratingKey},${probeFingerprint},'pending',${TECHNICAL_SNAPSHOT_VERSION},true,${sourceUpdatedAt},now(),now())`;
  }else if(changed){
    await sql`UPDATE plex_technical_state SET probe_fingerprint=${probeFingerprint},snapshot_status=CASE WHEN technical_fingerprint IS NULL THEN 'pending' ELSE 'stale' END,snapshot_version=${TECHNICAL_SNAPSHOT_VERSION},needs_refresh=true,source_updated_at=${sourceUpdatedAt},last_probe_at=now(),last_error=NULL,updated_at=now() WHERE rating_key=${ratingKey}`;
    await sql`UPDATE piko_quality SET status='stale',updated_at=now() WHERE rating_key=${ratingKey} AND status='evaluated'`;
  }else{
    await sql`UPDATE plex_technical_state SET source_updated_at=COALESCE(${sourceUpdatedAt},source_updated_at),last_probe_at=now(),updated_at=now() WHERE rating_key=${ratingKey}`;
  }
  return{rating_key:ratingKey,probe_fingerprint:probeFingerprint,changed,needs_refresh:changed||!current?.technical_fingerprint};
}

export async function persistTechnicalSnapshot(sql,item){
  const snapshot=normalizeTechnicalSnapshot(item);
  if(!snapshot.rating_key)throw new Error('ratingKey requerido para persistir snapshot técnico');
  const technicalFingerprint=buildTechnicalFingerprint(snapshot);
  const probeFingerprint=buildProbeFingerprint(item);
  const sourceUpdatedAt=item?.updatedAt?new Date(Number(item.updatedAt)*1000).toISOString():null;
  const mediaRows=snapshot.medias.map(m=>({rating_key:snapshot.rating_key,media_index:m.media_index,plex_media_id:m.plex_media_id,duration_ms:m.duration_ms,bitrate:m.bitrate,width:m.width,height:m.height,aspect_ratio:m.aspect_ratio,container:m.container,video_codec:m.video_codec,video_profile:m.video_profile,video_frame_rate:m.video_frame_rate,video_dynamic_range:m.video_dynamic_range,audio_codec:m.audio_codec,audio_profile:m.audio_profile,audio_channels:m.audio_channels}));
  const fileRows=snapshot.medias.flatMap(m=>m.parts.map(p=>({rating_key:snapshot.rating_key,media_index:m.media_index,part_index:p.part_index,plex_part_id:p.plex_part_id,file_path:p.file_path,file_size_bytes:p.file_size_bytes,duration_ms:p.duration_ms,container:p.container,accessible:p.accessible,exists_on_server:p.exists_on_server})));
  const streamRows=snapshot.medias.flatMap(m=>m.parts.flatMap(p=>p.streams.map(x=>({rating_key:snapshot.rating_key,media_index:m.media_index,part_index:p.part_index,stream_index:x.stream_index,stream_type:x.stream_type,codec:x.codec,profile:x.profile,bitrate:x.bitrate,bit_depth:x.bit_depth,dynamic_range:x.dynamic_range,color_space:x.color_space,chroma:x.chroma,width:x.width,height:x.height,frame_rate:x.frame_rate,channels:x.channels,language:x.language,is_selected:x.is_selected,is_default:x.is_default,is_forced:x.is_forced}))));

  await sql`DELETE FROM plex_streams WHERE rating_key=${snapshot.rating_key}`;
  await sql`DELETE FROM plex_files WHERE rating_key=${snapshot.rating_key}`;
  await sql`DELETE FROM plex_media WHERE rating_key=${snapshot.rating_key}`;

  if(mediaRows.length)await sql`WITH x AS (SELECT * FROM jsonb_to_recordset(${JSON.stringify(mediaRows)}::jsonb) AS t(rating_key text,media_index int,plex_media_id text,duration_ms bigint,bitrate int,width int,height int,aspect_ratio float8,container text,video_codec text,video_profile text,video_frame_rate text,video_dynamic_range text,audio_codec text,audio_profile text,audio_channels int)) INSERT INTO plex_media(rating_key,media_index,plex_media_id,duration_ms,bitrate,width,height,aspect_ratio,container,video_codec,video_profile,video_frame_rate,video_dynamic_range,audio_codec,audio_profile,audio_channels) SELECT rating_key,media_index,plex_media_id,duration_ms,bitrate,width,height,aspect_ratio,container,video_codec,video_profile,video_frame_rate,video_dynamic_range,audio_codec,audio_profile,audio_channels FROM x`;
  if(fileRows.length)await sql`WITH x AS (SELECT * FROM jsonb_to_recordset(${JSON.stringify(fileRows)}::jsonb) AS t(rating_key text,media_index int,part_index int,plex_part_id text,file_path text,file_size_bytes bigint,duration_ms bigint,container text,accessible bool,exists_on_server bool)) INSERT INTO plex_files(rating_key,media_index,part_index,plex_part_id,file_path,file_size_bytes,duration_ms,container,accessible,exists_on_server) SELECT rating_key,media_index,part_index,plex_part_id,file_path,file_size_bytes,duration_ms,container,accessible,exists_on_server FROM x`;
  if(streamRows.length)await sql`WITH x AS (SELECT * FROM jsonb_to_recordset(${JSON.stringify(streamRows)}::jsonb) AS t(rating_key text,media_index int,part_index int,stream_index int,stream_type int,codec text,profile text,bitrate int,bit_depth int,dynamic_range text,color_space text,chroma text,width int,height int,frame_rate text,channels int,language text,is_selected bool,is_default bool,is_forced bool)) INSERT INTO plex_streams(rating_key,media_index,part_index,stream_index,stream_type,codec,profile,bitrate,bit_depth,dynamic_range,color_space,chroma,width,height,frame_rate,channels,language,is_selected,is_default,is_forced,updated_at) SELECT rating_key,media_index,part_index,stream_index,stream_type,codec,profile,bitrate,bit_depth,dynamic_range,color_space,chroma,width,height,frame_rate,channels,language,is_selected,is_default,is_forced,now() FROM x`;

  await sql`INSERT INTO plex_technical_state(rating_key,probe_fingerprint,technical_fingerprint,snapshot_status,snapshot_version,needs_refresh,captured_at,source_updated_at,last_probe_at,last_error,updated_at) VALUES(${snapshot.rating_key},${probeFingerprint},${technicalFingerprint},'ready',${TECHNICAL_SNAPSHOT_VERSION},false,now(),${sourceUpdatedAt},now(),NULL,now()) ON CONFLICT(rating_key) DO UPDATE SET probe_fingerprint=EXCLUDED.probe_fingerprint,technical_fingerprint=EXCLUDED.technical_fingerprint,snapshot_status='ready',snapshot_version=EXCLUDED.snapshot_version,needs_refresh=false,captured_at=now(),source_updated_at=EXCLUDED.source_updated_at,last_probe_at=now(),last_error=NULL,updated_at=now()`;
  return{rating_key:snapshot.rating_key,technical_fingerprint:technicalFingerprint,probe_fingerprint:probeFingerprint,media_count:mediaRows.length,file_count:fileRows.length,stream_count:streamRows.length};
}

export async function markTechnicalCaptureError(sql,ratingKey,error){
  const message=String(error?.message||error||'Error desconocido').slice(0,1000);
  await sql`INSERT INTO plex_technical_state(rating_key,snapshot_status,snapshot_version,needs_refresh,last_error,updated_at) VALUES(${String(ratingKey)},'error',${TECHNICAL_SNAPSHOT_VERSION},true,${message},now()) ON CONFLICT(rating_key) DO UPDATE SET snapshot_status='error',needs_refresh=true,last_error=${message},updated_at=now()`;
}
