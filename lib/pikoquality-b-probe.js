import 'server-only';
import {db} from './db';
import {startRun,finishRun,errorInfo} from './runlog';

const CLIENT='pikofilm-pikoquality-probe';
const headers=token=>({'Accept':'application/json','X-Plex-Token':token,'X-Plex-Client-Identifier':CLIENT,'X-Plex-Product':'PikoFilm','X-Plex-Version':'3'});

function attrs(s){const out={};for(const m of s.matchAll(/([\w:-]+)="([^"]*)"/g))out[m[1]]=m[2].replaceAll('&amp;','&');return out}
async function discoverPlexUrl(token){
  if(process.env.PLEX_URL||process.env.PLEX_BASE_URL)return String(process.env.PLEX_URL||process.env.PLEX_BASE_URL).replace(/\/$/,'');
  const r=await fetch('https://plex.tv/api/resources?includeHttps=1',{headers:{'X-Plex-Token':token,'X-Plex-Client-Identifier':CLIENT},cache:'no-store',signal:AbortSignal.timeout(30000)});
  if(!r.ok)throw new Error(`No se pudo descubrir Plex (${r.status})`);
  const xml=await r.text(),devices=[...xml.matchAll(/<Device\b([^>]*)>([\s\S]*?)<\/Device>/g)];
  for(const d of devices){const a=attrs(d[1]);if(!String(a.provides||'').includes('server'))continue;const cons=[...d[2].matchAll(/<Connection\b([^>]*)\/?\s*>/g)].map(x=>attrs(x[1]));const best=cons.find(x=>x.local==='0'&&x.relay!=='1'&&String(x.uri||'').startsWith('https://'))||cons.find(x=>x.local==='0'&&x.relay!=='1')||cons.find(x=>x.relay==='1')||cons[0];if(best?.uri)return best.uri.replace(/\/$/,'')}
  throw new Error('Plex no publica una conexión remota accesible.');
}
async function pget(base,token,path){const r=await fetch(base+path,{headers:headers(token),cache:'no-store',signal:AbortSignal.timeout(30000)});if(!r.ok)throw new Error(`Plex ${path} respondió ${r.status}`);return r.json()}
const list=body=>body?.MediaContainer?.Metadata||body?.MediaContainer?.Video||[];
const n=v=>{const x=Number(v);return Number.isFinite(x)?x:null};

function streamSummary(s){
  const type=Number(s.streamType||0)===1?'video':Number(s.streamType||0)===2?'audio':Number(s.streamType||0)===3?'subtitle':'other';
  return {
    type,
    codec:s.codec||null,
    profile:s.profile||null,
    bitrate:n(s.bitrate),
    channels:n(s.channels),
    bit_depth:n(s.bitDepth),
    color_space:s.colorSpace||null,
    chroma:s.chromaSubsampling||null,
    color_primaries:s.colorPrimaries||null,
    color_trc:s.colorTrc||null,
    dynamic_range:s.DOVIProfile||s.DOVIBLCompatID||s.extendedDisplayTitle||null,
    default:Boolean(s.default),
    forced:Boolean(s.forced),
    selected:Boolean(s.selected)
  };
}

function parseTechnical(item){
  const medias=(item?.Media||[]).map(m=>({
    id:String(m.id||''),
    resolution:m.videoResolution||null,
    width:n(m.width),height:n(m.height),bitrate:n(m.bitrate),container:m.container||null,
    video_codec:m.videoCodec||null,video_profile:m.videoProfile||null,frame_rate:m.videoFrameRate||null,dynamic_range:m.videoDynamicRange||null,
    audio_codec:m.audioCodec||null,audio_profile:m.audioProfile||null,audio_channels:n(m.audioChannels),
    parts:(m.Part||[]).map(p=>({
      id:String(p.id||''),size:n(p.size),duration:n(p.duration),container:p.container||null,
      streams:(p.Stream||[]).map(streamSummary)
    }))
  }));
  const streams=medias.flatMap(m=>m.parts.flatMap(p=>p.streams));
  const video=streams.filter(s=>s.type==='video'),audio=streams.filter(s=>s.type==='audio'),subs=streams.filter(s=>s.type==='subtitle');
  return {
    media_count:medias.length,
    part_count:medias.reduce((a,m)=>a+m.parts.length,0),
    stream_count:streams.length,
    video_streams:video.length,
    audio_streams:audio.length,
    subtitle_streams:subs.length,
    has_video_bitrate:video.some(s=>s.bitrate!=null),
    has_audio_bitrate:audio.some(s=>s.bitrate!=null),
    has_bit_depth:video.some(s=>s.bit_depth!=null),
    has_color_space:video.some(s=>s.color_space||s.color_primaries||s.color_trc),
    has_chroma:video.some(s=>s.chroma),
    has_hdr_signal:Boolean(medias.some(m=>m.dynamic_range)||video.some(s=>s.dynamic_range)),
    video:video.slice(0,3),
    audio:audio.slice(0,6),
    subtitle_count:subs.length,
    media:medias.map(m=>({resolution:m.resolution,width:m.width,height:m.height,bitrate:m.bitrate,container:m.container,video_codec:m.video_codec,video_profile:m.video_profile,frame_rate:m.frame_rate,dynamic_range:m.dynamic_range,audio_codec:m.audio_codec,audio_profile:m.audio_profile,audio_channels:m.audio_channels}))
  };
}

async function pickSamples(sql){
  return sql`
    WITH candidates AS (
      SELECT p.rating_key,p.item_type,p.plex_title,p.plex_year,pm.resolution,pm.width,pm.height,pm.bitrate,pm.video_codec,pm.audio_codec,pm.audio_channels,
        CASE
          WHEN p.item_type='movie' AND (pm.resolution='1080' OR pm.width>=1900) AND lower(COALESCE(pm.video_codec,''))='hevc' THEN 1
          WHEN p.item_type='movie' AND (pm.resolution='1080' OR pm.width>=1900) AND lower(COALESCE(pm.video_codec,''))='h264' THEN 2
          WHEN p.item_type='movie' AND (pm.resolution='sd' OR pm.height<576) THEN 3
          WHEN p.item_type='episode' AND p.plex_year<2000 AND (pm.resolution='sd' OR pm.height<576) THEN 4
          WHEN p.item_type='episode' AND p.plex_year BETWEEN 2000 AND 2014 THEN 5
          WHEN p.item_type='episode' AND p.plex_year>=2020 AND (pm.resolution IN('720','1080') OR pm.width>=1200) THEN 6
          ELSE NULL END bucket
      FROM plex_items p
      JOIN LATERAL (SELECT * FROM plex_media x WHERE x.rating_key=p.rating_key ORDER BY media_index LIMIT 1) pm ON true
      WHERE p.active AND p.item_type IN('movie','episode')
    ), ranked AS (
      SELECT *,row_number() OVER(PARTITION BY bucket ORDER BY bitrate DESC NULLS LAST,rating_key) rn FROM candidates WHERE bucket IS NOT NULL
    )
    SELECT rating_key,item_type,plex_title,plex_year,resolution,width,height,bitrate,video_codec,audio_codec,audio_channels,bucket
    FROM ranked WHERE rn<=2 ORDER BY bucket,rn`;
}

export async function runPikoQualityBProbe(){
  const token=process.env.PLEX_TOKEN;if(!token)throw new Error('PLEX_TOKEN no está configurado en Vercel');
  const sql=db(),run=await startRun('pikoquality_b_probe','web',{stage:'select'});const started=Date.now();
  try{
    const base=await discoverPlexUrl(token),samples=await pickSamples(sql),results=[];
    for(const s of samples){
      const body=await pget(base,token,`/library/metadata/${s.rating_key}?includeGuids=1`),item=list(body)[0]||{},detail=parseTechnical(item);
      results.push({
        rating_key:s.rating_key,type:s.item_type,title:s.plex_title,year:s.plex_year,bucket:s.bucket,
        phase_a:{resolution:s.resolution,width:s.width,height:s.height,bitrate:s.bitrate,video_codec:s.video_codec,audio_codec:s.audio_codec,audio_channels:s.audio_channels},
        phase_b:detail
      });
    }
    const coverage={
      samples:results.length,
      with_streams:results.filter(x=>x.phase_b.stream_count>0).length,
      video_bitrate:results.filter(x=>x.phase_b.has_video_bitrate).length,
      audio_bitrate:results.filter(x=>x.phase_b.has_audio_bitrate).length,
      bit_depth:results.filter(x=>x.phase_b.has_bit_depth).length,
      color_space:results.filter(x=>x.phase_b.has_color_space).length,
      chroma:results.filter(x=>x.phase_b.has_chroma).length,
      hdr_signal:results.filter(x=>x.phase_b.has_hdr_signal).length,
      multiple_audio:results.filter(x=>x.phase_b.audio_streams>1).length,
      subtitles:results.filter(x=>x.phase_b.subtitle_streams>0).length
    };
    await finishRun(run.id,'success',{processed:results.length,updated:results.length,summary:{stage:'done',elapsed_ms:Date.now()-started,coverage,results}});
    return{ok:true,count:results.length,coverage};
  }catch(e){await finishRun(run.id,'failed',{errors:1,summary:{stage:'failed',error:errorInfo(e),elapsed_ms:Date.now()-started}});throw e}
}

export async function getLatestPikoQualityBProbe(){
  const sql=db();const [r]=await sql`SELECT id,status,started_at,finished_at,processed_count,error_count,summary FROM pipeline_runs WHERE job_type='pikoquality_b_probe' ORDER BY id DESC LIMIT 1`;return r||null;
}
