import 'server-only';
import {db} from './db';import {ensureQualitySchema,scoreMovie,scoreEpisode,band,QUALITY_VERSION} from './pikoquality';
const CLIENT='pikofilm-quality';const attrs=s=>Object.fromEntries([...s.matchAll(/([\w:-]+)="([^"]*)"/g)].map(m=>[m[1],m[2]]));
async function baseUrl(token){if(process.env.PLEX_URL||process.env.PLEX_BASE_URL)return String(process.env.PLEX_URL||process.env.PLEX_BASE_URL).replace(/\/$/,'');const r=await fetch('https://plex.tv/api/resources?includeHttps=1',{headers:{'X-Plex-Token':token,'X-Plex-Client-Identifier':CLIENT},cache:'no-store'});const xml=await r.text();for(const d of xml.matchAll(/<Device\b([^>]*)>([\s\S]*?)<\/Device>/g)){const a=attrs(d[1]);if(!String(a.provides||'').includes('server'))continue;const c=[...d[2].matchAll(/<Connection\b([^>]*)\/?\s*>/g)].map(x=>attrs(x[1]));const b=c.find(x=>x.local==='0'&&x.relay!=='1'&&String(x.uri||'').startsWith('https://'))||c.find(x=>x.local==='0'&&x.relay!=='1')||c[0];if(b?.uri)return b.uri.replace(/\/$/,'')}throw new Error('Sin conexión Plex remota')}
async function detail(base,token,key){const r=await fetch(`${base}/library/metadata/${key}`,{headers:{Accept:'application/json','X-Plex-Token':token,'X-Plex-Client-Identifier':CLIENT},cache:'no-store',signal:AbortSignal.timeout(30000)});if(r.status===404)return null;if(!r.ok)throw new Error(`Plex ${r.status}`);const b=await r.json();return (b?.MediaContainer?.Metadata||[])[0]||null}
const dyn=s=>s.DOVIPresent?'Dolby Vision':s.HDR10PlusPresent?'HDR10+':s.HDR10Present?'HDR10':s.dynamicRange||s.videoDynamicRange||null;
export async function enrichPending(limit=50){
  await ensureQualitySchema();
  const token=process.env.PLEX_TOKEN;if(!token)throw new Error('PLEX_TOKEN no configurado');
  const sql=db(),base=await baseUrl(token);
  const rows=await sql`SELECT p.rating_key,p.item_type,m.resolution,m.width,m.height,m.bitrate,m.video_codec,m.video_profile,m.video_frame_rate,m.audio_codec,m.audio_profile,m.audio_channels,m.container,f.file_size_bytes,f.duration_ms FROM plex_items p JOIN plex_media m ON m.rating_key=p.rating_key AND m.media_index=0 LEFT JOIN plex_files f ON f.rating_key=p.rating_key AND f.media_index=0 AND f.part_index=0 LEFT JOIN piko_quality q ON q.rating_key=p.rating_key WHERE p.active AND p.item_type IN ('movie','episode') AND (q.rating_key IS NULL OR q.enriched_at IS NULL OR q.status='pending') ORDER BY p.updated_at DESC NULLS LAST LIMIT ${limit}`;
  let enriched=0,stale=0,errors=0;
  for(const r of rows){
    try{
      const item=await detail(base,token,r.rating_key);
      if(!item){await sql`INSERT INTO piko_quality(rating_key,item_type,formula_version,status,confidence,updated_at) VALUES(${r.rating_key},${r.item_type},${QUALITY_VERSION},'stale','low',now()) ON CONFLICT(rating_key) DO UPDATE SET status='stale',confidence='low',updated_at=now()`;stale++;continue}
      await sql`DELETE FROM plex_streams WHERE rating_key=${r.rating_key}`;
      let si=0,bestV=null,bestA=null;
      for(const [mi,m] of (item.Media||[]).entries())for(const [pi,p] of (m.Part||[]).entries())for(const s of (p.Stream||[])){
        const type=Number(s.streamType||0),bitrate=Number(s.bitrate||0)||null,bd=Number(s.bitDepth||s.bit_depth||0)||null,dr=dyn(s);
        await sql`INSERT INTO plex_streams(rating_key,media_index,part_index,stream_index,stream_type,codec,profile,bitrate,bit_depth,dynamic_range,color_space,chroma,channels,language,is_selected,is_default,is_forced,raw) VALUES(${r.rating_key},${mi},${pi},${si++},${type},${s.codec||null},${s.profile||null},${bitrate},${bd},${dr},${s.colorSpace||s.colorTrc||null},${s.chromaSubsampling||s.chromaLocation||null},${Number(s.channels||0)||null},${s.language||s.languageCode||null},${Boolean(s.selected)},${Boolean(s.default)},${Boolean(s.forced)},${JSON.stringify(s)}::jsonb)`;
        if(type===1&&(!bestV||(bitrate||0)>(bestV.bitrate||0)))bestV={codec:s.codec,profile:s.profile,bitrate,bit_depth:bd,dynamic_range:dr};
        if(type===2&&(!bestA||audioRank(s)>audioRank(bestA)))bestA={codec:s.codec,profile:s.profile,bitrate,channels:Number(s.channels||0)||null};
      }
      const x={...r,video_stream_bitrate:bestV?.bitrate,bit_depth:bestV?.bit_depth,dynamic_range:bestV?.dynamic_range,audio_stream_codec:bestA?.codec,audio_stream_profile:bestA?.profile,audio_stream_bitrate:bestA?.bitrate,audio_stream_channels:bestA?.channels};
      const score=r.item_type==='episode'?scoreEpisode(x):scoreMovie(x);
      await sql`INSERT INTO piko_quality(rating_key,item_type,score,band,confidence,formula_version,status,enriched_at,evaluated_at,updated_at) VALUES(${r.rating_key},${r.item_type},${score},${band(score)},'high',${QUALITY_VERSION},'evaluated',now(),now(),now()) ON CONFLICT(rating_key) DO UPDATE SET score=excluded.score,band=excluded.band,confidence='high',formula_version=excluded.formula_version,status='evaluated',enriched_at=now(),evaluated_at=now(),updated_at=now()`;
      enriched++;
    }catch(e){errors++;}
  }
  return{requested:rows.length,enriched,stale,errors};
}
function audioRank(s){const x=String((s.codec||'')+' '+(s.profile||'')).toLowerCase();let n=x.includes('truehd')||x.includes('atmos')||x.includes('dts-hd')||x.includes('dca-ma')?100:x.includes('eac3')||x.includes('dts')?80:x.includes('ac3')?60:x.includes('aac')?50:30;return n+Number(s.channels||0)*2+Number(s.bitrate||0)/1000}
