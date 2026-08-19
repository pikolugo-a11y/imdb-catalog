import 'server-only';
import {db} from './db';
import {ensureQualitySchema,scoreMovie,scoreEpisode,band,QUALITY_VERSION} from './pikoquality';

export const DEFAULT_B_BATCH=120;
const CLIENT='pikofilm-quality';
const attrs=s=>Object.fromEntries([...s.matchAll(/([\w:-]+)="([^"]*)"/g)].map(m=>[m[1],m[2]]));
const dyn=s=>s.DOVIPresent?'Dolby Vision':s.HDR10PlusPresent?'HDR10+':s.HDR10Present?'HDR10':s.dynamicRange||s.videoDynamicRange||null;

async function startRun(summary){
  const sql=db();
  await sql`UPDATE pipeline_runs SET status='failed',finished_at=now(),updated_at=now(),summary=COALESCE(summary,'{}'::jsonb)||${JSON.stringify({reason:'stale_running_recovered'})}::jsonb WHERE job_type='pikoquality_b' AND status='running' AND started_at<now()-interval '15 minutes'`;
  const [r]=await sql`INSERT INTO pipeline_runs(job_type,source,status,started_at,processed_count,added_count,updated_count,skipped_count,error_count,summary,created_at,updated_at) VALUES('pikoquality_b','frontend','running',now(),0,0,0,0,0,${JSON.stringify(summary)}::jsonb,now(),now()) RETURNING id`;
  return r.id;
}
async function finishRun(id,status,counts,summary){const sql=db();await sql`UPDATE pipeline_runs SET status=${status},finished_at=now(),processed_count=${counts.processed||0},added_count=0,updated_count=${counts.updated||0},skipped_count=${counts.skipped||0},error_count=${counts.errors||0},summary=${JSON.stringify(summary)}::jsonb,updated_at=now() WHERE id=${id}`;}

async function baseUrl(token){
  if(process.env.PLEX_URL||process.env.PLEX_BASE_URL)return String(process.env.PLEX_URL||process.env.PLEX_BASE_URL).replace(/\/$/,'');
  const r=await fetch('https://plex.tv/api/resources?includeHttps=1',{headers:{'X-Plex-Token':token,'X-Plex-Client-Identifier':CLIENT},cache:'no-store'});
  if(!r.ok)throw new Error(`No se pudo descubrir Plex (${r.status})`);
  const xml=await r.text();
  for(const d of xml.matchAll(/<Device\b([^>]*)>([\s\S]*?)<\/Device>/g)){
    const a=attrs(d[1]);if(!String(a.provides||'').includes('server'))continue;
    const c=[...d[2].matchAll(/<Connection\b([^>]*)\/?\s*>/g)].map(x=>attrs(x[1]));
    const b=c.find(x=>x.local==='0'&&x.relay!=='1'&&String(x.uri||'').startsWith('https://'))||c.find(x=>x.local==='0'&&x.relay!=='1')||c.find(x=>x.relay==='1')||c[0];
    if(b?.uri)return b.uri.replace(/\/$/,'');
  }
  throw new Error('Sin conexión Plex remota');
}
async function detail(base,token,key){
  const r=await fetch(`${base}/library/metadata/${key}`,{headers:{Accept:'application/json','X-Plex-Token':token,'X-Plex-Client-Identifier':CLIENT,'X-Plex-Product':'PikoFilm','X-Plex-Version':'3'},cache:'no-store',signal:AbortSignal.timeout(30000)});
  if(r.status===404)return null;
  if(!r.ok)throw new Error(`Plex respondió ${r.status}`);
  const b=await r.json();return (b?.MediaContainer?.Metadata||[])[0]||null;
}
function audioRank(s){const x=String((s.codec||'')+' '+(s.profile||'')).toLowerCase();let n=x.includes('truehd')||x.includes('atmos')||x.includes('dts-hd')||x.includes('dca-ma')?100:x.includes('eac3')||x.includes('dts')?80:x.includes('ac3')?60:x.includes('aac')?50:30;return n+Number(s.channels||0)*2+Number(s.bitrate||0)/1000;}
function parseItem(row,item){
  let streamIndex=0,bestV=null,bestA=null;const streams=[];
  for(const [mi,m] of (item.Media||[]).entries())for(const [pi,p] of (m.Part||[]).entries())for(const s of (p.Stream||[])){
    const type=Number(s.streamType||0),bitrate=Number(s.bitrate||0)||null,bitDepth=Number(s.bitDepth||s.bit_depth||0)||null,dynamicRange=dyn(s);
    streams.push({rating_key:row.rating_key,media_index:mi,part_index:pi,stream_index:streamIndex++,stream_type:type,codec:s.codec||null,profile:s.profile||null,bitrate,bit_depth:bitDepth,dynamic_range:dynamicRange,color_space:s.colorSpace||s.colorTrc||s.colorPrimaries||null,chroma:s.chromaSubsampling||s.chromaLocation||null,channels:Number(s.channels||0)||null,language:s.language||s.languageCode||null,is_selected:Boolean(s.selected),is_default:Boolean(s.default),is_forced:Boolean(s.forced),raw:s});
    if(type===1&&(!bestV||(bitrate||0)>(bestV.bitrate||0)))bestV={codec:s.codec,profile:s.profile,bitrate,bit_depth:bitDepth,dynamic_range:dynamicRange};
    if(type===2&&(!bestA||audioRank(s)>audioRank(bestA)))bestA={codec:s.codec,profile:s.profile,bitrate,channels:Number(s.channels||0)||null};
  }
  const scored={...row,video_stream_bitrate:bestV?.bitrate,bit_depth:bestV?.bit_depth,dynamic_range:bestV?.dynamic_range,audio_stream_codec:bestA?.codec,audio_stream_profile:bestA?.profile,audio_stream_bitrate:bestA?.bitrate,audio_stream_channels:bestA?.channels};
  const score=row.item_type==='episode'?scoreEpisode(scored,row.season_median):scoreMovie(scored);
  return{row,score,streams,streamCount:streams.length};
}

export async function enrichPending(limit=DEFAULT_B_BATCH,includeErrors=false){
  await ensureQualitySchema();
  const token=process.env.PLEX_TOKEN;if(!token)throw new Error('PLEX_TOKEN no configurado');
  const sql=db(),batch=Math.max(1,Math.min(250,Number(limit)||DEFAULT_B_BATCH)),runId=await startRun({formulaVersion:QUALITY_VERSION,batch,includeErrors});
  try{
    const base=await baseUrl(token);
    const rows=await sql`
      WITH season_stats AS (
        SELECT p.grandparent_rating_key,p.parent_index,percentile_cont(0.5) WITHIN GROUP (ORDER BY m.bitrate) median_bitrate
        FROM plex_items p JOIN plex_media m ON m.rating_key=p.rating_key AND m.media_index=0
        WHERE p.active AND p.item_type='episode' AND m.bitrate IS NOT NULL GROUP BY p.grandparent_rating_key,p.parent_index
      )
      SELECT p.rating_key,p.item_type,p.fingerprint,p.grandparent_rating_key,p.parent_index,m.resolution,m.width,m.height,m.bitrate,m.video_codec,m.video_profile,m.video_frame_rate,m.audio_codec,m.audio_profile,m.audio_channels,m.container,f.file_size_bytes,f.duration_ms,ss.median_bitrate season_median
      FROM plex_items p JOIN plex_media m ON m.rating_key=p.rating_key AND m.media_index=0
      LEFT JOIN plex_files f ON f.rating_key=p.rating_key AND f.media_index=0 AND f.part_index=0
      JOIN piko_quality q ON q.rating_key=p.rating_key
      LEFT JOIN season_stats ss ON ss.grandparent_rating_key=p.grandparent_rating_key AND ss.parent_index=p.parent_index
      WHERE p.active AND p.item_type IN('movie','episode') AND q.formula_version=${QUALITY_VERSION} AND q.source_fingerprint=p.fingerprint AND ((q.status='evaluated' AND q.enriched_at IS NULL) OR (${Boolean(includeErrors)} AND q.status='error'))
      ORDER BY p.updated_at DESC NULLS LAST,p.rating_key LIMIT ${batch}`;
    const success=[],stale=[],failed=[];
    for(let i=0;i<rows.length;i+=12){
      const chunk=rows.slice(i,i+12);
      const got=await Promise.all(chunk.map(async row=>{try{const item=await detail(base,token,row.rating_key);return item?{kind:'success',value:parseItem(row,item)}:{kind:'stale',row};}catch(e){return{kind:'error',row,error:String(e?.message||e).slice(0,500)};}}));
      for(const g of got){if(g.kind==='success')success.push(g.value);else if(g.kind==='stale')stale.push(g.row);else failed.push(g);}
    }
    if(success.length){
      const keys=success.map(x=>x.row.rating_key);await sql`DELETE FROM plex_streams WHERE rating_key=ANY(${keys})`;
      const streamPayload=success.flatMap(x=>x.streams);
      if(streamPayload.length)await sql`WITH x AS (SELECT * FROM jsonb_to_recordset(${JSON.stringify(streamPayload)}::jsonb) AS t(rating_key text,media_index int,part_index int,stream_index int,stream_type int,codec text,profile text,bitrate int,bit_depth int,dynamic_range text,color_space text,chroma text,channels int,language text,is_selected bool,is_default bool,is_forced bool,raw jsonb)) INSERT INTO plex_streams(rating_key,media_index,part_index,stream_index,stream_type,codec,profile,bitrate,bit_depth,dynamic_range,color_space,chroma,channels,language,is_selected,is_default,is_forced,raw,updated_at) SELECT rating_key,media_index,part_index,stream_index,stream_type,codec,profile,bitrate,bit_depth,dynamic_range,color_space,chroma,channels,language,is_selected,is_default,is_forced,raw,now() FROM x`;
      const qPayload=success.map(x=>({rating_key:x.row.rating_key,item_type:x.row.item_type,score:x.score,band:band(x.score),source_fingerprint:x.row.fingerprint}));
      await sql`WITH x AS (SELECT * FROM jsonb_to_recordset(${JSON.stringify(qPayload)}::jsonb) AS t(rating_key text,item_type text,score int,band text,source_fingerprint text)) UPDATE piko_quality q SET item_type=x.item_type,score=x.score,band=x.band,confidence='high',formula_version=${QUALITY_VERSION},status='evaluated',source_fingerprint=x.source_fingerprint,enriched_at=now(),last_error=NULL,evaluated_at=now(),updated_at=now() FROM x WHERE q.rating_key=x.rating_key`;
    }
    if(stale.length){const payload=stale.map(r=>({rating_key:r.rating_key,source_fingerprint:r.fingerprint}));await sql`WITH x AS (SELECT * FROM jsonb_to_recordset(${JSON.stringify(payload)}::jsonb) AS t(rating_key text,source_fingerprint text)) UPDATE piko_quality q SET status='stale',confidence='low',source_fingerprint=x.source_fingerprint,last_error='Plex 404',updated_at=now() FROM x WHERE q.rating_key=x.rating_key`;}
    if(failed.length){const payload=failed.map(x=>({rating_key:x.row.rating_key,source_fingerprint:x.row.fingerprint,last_error:x.error}));await sql`WITH x AS (SELECT * FROM jsonb_to_recordset(${JSON.stringify(payload)}::jsonb) AS t(rating_key text,source_fingerprint text,last_error text)) UPDATE piko_quality q SET status='error',confidence='low',source_fingerprint=x.source_fingerprint,last_error=x.last_error,updated_at=now() FROM x WHERE q.rating_key=x.rating_key`;}
    const [left]=await sql`SELECT count(*)::int n FROM plex_items p JOIN piko_quality q ON q.rating_key=p.rating_key WHERE p.active AND p.item_type IN('movie','episode') AND q.status='evaluated' AND q.formula_version=${QUALITY_VERSION} AND q.source_fingerprint=p.fingerprint AND q.enriched_at IS NULL`;
    const counts={processed:rows.length,updated:success.length,skipped:stale.length,errors:failed.length};
    await finishRun(runId,'success',counts,{formulaVersion:QUALITY_VERSION,batch,includeErrors,enriched:success.length,stale:stale.length,errors:failed.length,remaining:left.n,streams:success.reduce((a,x)=>a+x.streamCount,0)});
    return{requested:rows.length,enriched:success.length,stale:stale.length,errors:failed.length,remaining:left.n};
  }catch(e){await finishRun(runId,'failed',{processed:0,updated:0,skipped:0,errors:1},{formulaVersion:QUALITY_VERSION,error:String(e?.message||e)});throw e;}
}
