import 'server-only';
import {db} from './db';

const CLIENT='pikofilm-quality-pilot';
const headers=token=>({'Accept':'application/json','X-Plex-Token':token,'X-Plex-Client-Identifier':CLIENT,'X-Plex-Product':'PikoFilm','X-Plex-Version':'3'});
const val=(...xs)=>xs.find(x=>x!==undefined&&x!==null&&x!=='')??null;

function attrs(s){const out={};for(const m of s.matchAll(/([\w:-]+)="([^"]*)"/g))out[m[1]]=m[2].replaceAll('&amp;','&');return out}
async function discoverPlexUrl(token){
  if(process.env.PLEX_URL||process.env.PLEX_BASE_URL)return String(process.env.PLEX_URL||process.env.PLEX_BASE_URL).replace(/\/$/,'');
  const r=await fetch('https://plex.tv/api/resources?includeHttps=1',{headers:{'X-Plex-Token':token,'X-Plex-Client-Identifier':CLIENT},cache:'no-store'});
  if(!r.ok)throw new Error(`No se pudo descubrir Plex (${r.status})`);
  const xml=await r.text();
  for(const d of xml.matchAll(/<Device\b([^>]*)>([\s\S]*?)<\/Device>/g)){const a=attrs(d[1]);if(!String(a.provides||'').includes('server'))continue;const cons=[...d[2].matchAll(/<Connection\b([^>]*)\/?\s*>/g)].map(x=>attrs(x[1]));const best=cons.find(x=>x.local==='0'&&x.relay!=='1'&&String(x.uri||'').startsWith('https://'))||cons.find(x=>x.local==='0'&&x.relay!=='1')||cons.find(x=>x.relay==='1')||cons[0];if(best?.uri)return best.uri.replace(/\/$/,'')}
  throw new Error('Plex no publica una conexión remota accesible.');
}
async function pget(base,token,path){const r=await fetch(base+path,{headers:headers(token),cache:'no-store',signal:AbortSignal.timeout(30000)});if(!r.ok)throw new Error(`Plex respondió ${r.status}`);return r.json()}
function firstMeta(body){const c=body?.MediaContainer||{};return (c.Metadata||c.Video||c.Directory||[])[0]||{}}
function streamRows(item){return (item.Media||[]).flatMap((m,mi)=>(m.Part||[]).flatMap((p,pi)=>(p.Stream||[]).map(s=>({media:mi+1,part:pi+1,type:Number(s.streamType)===1?'video':Number(s.streamType)===2?'audio':Number(s.streamType)===3?'subtitle':String(s.streamType||'?'),codec:s.codec||null,profile:s.profile||null,bitrate:s.bitrate??null,bitDepth:val(s.bitDepth,s.bit_depth),dynamicRange:val(s.DOVIPresent?'Dolby Vision':null,s.HDR10PlusPresent?'HDR10+':null,s.HDR10Present?'HDR10':null,s.dynamicRange,s.videoDynamicRange),colorSpace:val(s.colorSpace,s.colorTrc,s.colorPrimaries),chroma:val(s.chromaSubsampling,s.chromaLocation),channels:s.channels??null,language:s.language||s.languageCode||null,selected:Boolean(s.selected),default:Boolean(s.default),forced:Boolean(s.forced)}))))}
function summarizeB(item){const streams=streamRows(item),video=streams.filter(x=>x.type==='video'),audio=streams.filter(x=>x.type==='audio'),subs=streams.filter(x=>x.type==='subtitle');return{streamCount:streams.length,videoStreams:video.length,audioStreams:audio.length,subtitleStreams:subs.length,bitDepth:[...new Set(video.map(x=>x.bitDepth).filter(Boolean))].join(', ')||null,dynamicRange:[...new Set(video.map(x=>x.dynamicRange).filter(Boolean))].join(', ')||null,videoBitrate:[...new Set(video.map(x=>x.bitrate).filter(Boolean))].join(', ')||null,audioBitrate:[...new Set(audio.map(x=>x.bitrate).filter(Boolean))].join(', ')||null,videoCodecs:[...new Set(video.map(x=>[x.codec,x.profile].filter(Boolean).join(' / ')).filter(Boolean))].join(', ')||null,audioCodecs:[...new Set(audio.map(x=>[x.codec,x.profile,x.channels?`${x.channels}ch`:null].filter(Boolean).join(' / ')).filter(Boolean))].join(', ')||null,color:[...new Set(video.map(x=>[x.colorSpace,x.chroma].filter(Boolean).join(' / ')).filter(Boolean))].join(', ')||null,subtitleLanguages:[...new Set(subs.map(x=>x.language).filter(Boolean))].join(', ')||null,streams};}

export async function runPikoQualityBPilot(){
  const token=process.env.PLEX_TOKEN;if(!token)throw new Error('PLEX_TOKEN no está configurado');
  const sql=db(),base=await discoverPlexUrl(token);
  const rows=await sql`
    WITH candidates AS (
      SELECT p.rating_key,p.item_type,p.plex_title,p.plex_year,p.parent_index,p.item_index,p.grandparent_rating_key,
             m.resolution,m.width,m.height,m.bitrate,m.video_codec,m.video_profile,m.video_frame_rate,m.video_dynamic_range,m.audio_codec,m.audio_profile,m.audio_channels,
             f.file_size_bytes,f.duration_ms,
             CASE
               WHEN p.item_type='movie' AND (m.resolution='4k' OR m.height>=2000) THEN 1
               WHEN p.item_type='movie' AND (m.resolution='1080' OR m.width>=1800) AND lower(coalesce(m.video_codec,'')) LIKE '%hevc%' THEN 2
               WHEN p.item_type='movie' AND (m.resolution='1080' OR m.width>=1800) THEN 3
               WHEN p.item_type='movie' AND coalesce(m.height,0)<700 THEN 4
               WHEN p.item_type='episode' AND coalesce(p.plex_year,0)<2000 AND coalesce(m.height,0)<700 THEN 5
               WHEN p.item_type='episode' AND coalesce(p.plex_year,0)>=2018 AND (m.resolution IN ('720','1080','4k') OR m.height>=700) THEN 6
               WHEN p.item_type='episode' AND coalesce(m.height,0)<700 THEN 7
               WHEN p.item_type='episode' THEN 8 ELSE 99 END bucket
      FROM plex_items p JOIN plex_media m ON m.rating_key=p.rating_key AND m.media_index=0 LEFT JOIN plex_files f ON f.rating_key=p.rating_key AND f.media_index=0 AND f.part_index=0
      WHERE p.active AND p.item_type IN ('movie','episode')
    ), ranked AS (SELECT *,row_number() OVER(PARTITION BY bucket ORDER BY md5(rating_key)) rn FROM candidates WHERE bucket<99)
    SELECT * FROM ranked WHERE rn<=2 ORDER BY bucket,rn LIMIT 16`;
  const results=[];
  for(const r of rows){
    try{const body=await pget(base,token,`/library/metadata/${r.rating_key}`),item=firstMeta(body);results.push({ok:true,ratingKey:r.rating_key,title:r.plex_title,year:r.plex_year,type:r.item_type,season:r.parent_index,episode:r.item_index,a:{resolution:r.resolution,dimensions:r.width&&r.height?`${r.width}×${r.height}`:null,bitrate:r.bitrate,video:[r.video_codec,r.video_profile].filter(Boolean).join(' / ')||null,frameRate:r.video_frame_rate,dynamicRange:r.video_dynamic_range,audio:[r.audio_codec,r.audio_profile,r.audio_channels?`${r.audio_channels}ch`:null].filter(Boolean).join(' / ')||null,size:r.file_size_bytes,duration:r.duration_ms},b:summarizeB(item)});}catch(e){results.push({ok:false,ratingKey:r.rating_key,title:r.plex_title,type:r.item_type,error:String(e?.message||e)})}
  }
  const gains={tested:results.length,ok:results.filter(x=>x.ok).length,withStreams:results.filter(x=>x.ok&&x.b.streamCount).length,withBitDepth:results.filter(x=>x.ok&&x.b.bitDepth).length,withDynamicRange:results.filter(x=>x.ok&&x.b.dynamicRange).length,withVideoBitrate:results.filter(x=>x.ok&&x.b.videoBitrate).length,withAudioBitrate:results.filter(x=>x.ok&&x.b.audioBitrate).length,withMultipleAudio:results.filter(x=>x.ok&&x.b.audioStreams>1).length,withSubtitles:results.filter(x=>x.ok&&x.b.subtitleStreams>0).length};
  return{generatedAt:new Date().toISOString(),readOnly:true,gains,results};
}
