import crypto from 'node:crypto';

export const TECHNICAL_SNAPSHOT_VERSION='1';

const n=v=>{const x=Number(v);return Number.isFinite(x)?x:null};
const s=v=>{const x=String(v??'').trim();return x||null};
const bool=v=>v==null?null:(v===true||v===1||v==='1'||String(v).toLowerCase()==='true');
const filenameOf=v=>{const x=s(v);if(!x)return null;const p=x.split(/[\\/]/);return p[p.length-1]||null};
const stable=v=>JSON.stringify(v,Object.keys(v).sort());
const sha=v=>crypto.createHash('sha256').update(typeof v==='string'?v:stable(v)).digest('hex');

export function normalizeTechnicalSnapshot(item){
  const ratingKey=String(item?.ratingKey??item?.rating_key??'');
  const medias=(item?.Media||[]).map((media,mediaIndex)=>({
    media_index:mediaIndex,
    plex_media_id:s(media?.id),
    duration_ms:n(media?.duration),
    bitrate:n(media?.bitrate),
    width:n(media?.width),
    height:n(media?.height),
    aspect_ratio:n(media?.aspectRatio),
    container:s(media?.container),
    video_codec:s(media?.videoCodec),
    video_profile:s(media?.videoProfile),
    video_frame_rate:s(media?.videoFrameRate),
    video_dynamic_range:s(media?.videoDynamicRange),
    audio_codec:s(media?.audioCodec),
    audio_profile:s(media?.audioProfile),
    audio_channels:n(media?.audioChannels),
    parts:(media?.Part||[]).map((part,partIndex)=>({
      part_index:partIndex,
      plex_part_id:s(part?.id),
      file_path:filenameOf(part?.file),
      file_size_bytes:n(part?.size),
      duration_ms:n(part?.duration),
      container:s(part?.container),
      accessible:bool(part?.accessible),
      exists_on_server:bool(part?.exists),
      streams:(part?.Stream||[]).map((stream,streamIndex)=>({
        stream_index:streamIndex,
        stream_type:n(stream?.streamType),
        codec:s(stream?.codec),
        profile:s(stream?.profile),
        bitrate:n(stream?.bitrate),
        bit_depth:n(stream?.bitDepth),
        dynamic_range:s(stream?.dynamicRange||stream?.DOVIPresent||stream?.HDRFormat),
        color_space:s(stream?.colorSpace),
        chroma:s(stream?.chromaSubsampling||stream?.chromaLocation),
        width:n(stream?.width),
        height:n(stream?.height),
        frame_rate:s(stream?.frameRate||stream?.frameRateMode),
        channels:n(stream?.channels),
        language:s(stream?.language||stream?.languageCode),
        is_selected:bool(stream?.selected),
        is_default:bool(stream?.default),
        is_forced:bool(stream?.forced),
      }))
    }))
  }));
  return{rating_key:ratingKey,medias};
}

export function buildPhysicalIdentity(item){
  const snapshot=normalizeTechnicalSnapshot(item);
  return snapshot.medias.flatMap(m=>m.parts.map(p=>({
    id:p.plex_part_id,
    file:p.file_path,
    size:p.file_size_bytes,
    duration:p.duration_ms,
  }))).sort((a,b)=>String(a.id||'').localeCompare(String(b.id||''))||String(a.file||'').localeCompare(String(b.file||'')));
}

export function buildProbeFingerprint(item){
  const snapshot=normalizeTechnicalSnapshot(item);
  const reduced={rating_key:snapshot.rating_key,parts:buildPhysicalIdentity(item)};
  return sha(JSON.stringify(reduced));
}

export function buildTechnicalFingerprint(snapshot){
  const canonical={
    rating_key:String(snapshot?.rating_key||''),
    medias:(snapshot?.medias||[]).map(m=>({
      media_index:m.media_index,plex_media_id:m.plex_media_id,duration_ms:m.duration_ms,bitrate:m.bitrate,width:m.width,height:m.height,
      aspect_ratio:m.aspect_ratio,container:m.container,video_codec:m.video_codec,video_profile:m.video_profile,
      video_frame_rate:m.video_frame_rate,video_dynamic_range:m.video_dynamic_range,audio_codec:m.audio_codec,
      audio_profile:m.audio_profile,audio_channels:m.audio_channels,
      parts:(m.parts||[]).map(p=>({
        part_index:p.part_index,plex_part_id:p.plex_part_id,file_path:p.file_path,file_size_bytes:p.file_size_bytes,duration_ms:p.duration_ms,container:p.container,
        streams:(p.streams||[]).map(x=>({stream_index:x.stream_index,stream_type:x.stream_type,codec:x.codec,profile:x.profile,bitrate:x.bitrate,bit_depth:x.bit_depth,dynamic_range:x.dynamic_range,color_space:x.color_space,chroma:x.chroma,width:x.width,height:x.height,frame_rate:x.frame_rate,channels:x.channels,language:x.language,is_selected:x.is_selected,is_default:x.is_default,is_forced:x.is_forced}))
      }))
    }))
  };
  return sha(JSON.stringify(canonical));
}

export function selectPrimaryAudioStream(streams=[]){
  const audio=streams.filter(x=>Number(x?.stream_type)===2);
  if(!audio.length)return null;
  return audio.find(x=>x.is_selected===true)||audio.find(x=>x.is_default===true)||audio[0];
}
