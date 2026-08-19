import 'server-only';
import {db} from './db';

export const QUALITY_VERSION='1.0.0';
export const DEFAULT_A_BATCH=5000;

const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
const norm=s=>String(s||'').toLowerCase();
const pct=(n,d)=>d?Math.round((Number(n||0)*1000)/Number(d))/10:0;

function resolutionPoints(r){
  const w=Number(r.width||0),h=Number(r.height||0),label=norm(r.resolution);
  if(label==='4k'||w>=3000||h>=1800)return 30;
  if(label==='1080'||w>=1800||h>=790)return 24;
  if(label==='720'||w>=1200||h>=650)return 18;
  if(label==='576'||h>=540)return 13;
  if(label==='480'||h>=430)return 10;
  return 6;
}
function videoCodecPoints(c){
  c=norm(c);
  if(c.includes('av1'))return 7;
  if(c.includes('hevc')||c.includes('h265'))return 7;
  if(c.includes('h264')||c.includes('avc'))return 6;
  if(c.includes('mpeg4'))return 3;
  if(c.includes('mpeg2'))return 2;
  return 1;
}
function audioCodecPoints(c,profile=''){
  const x=norm(c+' '+profile);
  if(x.includes('truehd')||x.includes('dts-hd')||x.includes('dca-ma')||x.includes('flac')||x.includes('pcm')||x.includes('atmos'))return 13;
  if(x.includes('eac3')||x.includes('dts')||x.includes('dca'))return 11;
  if(x.includes('ac3'))return 9;
  if(x.includes('aac'))return 8;
  if(x.includes('mp3')||x.includes('mp2'))return 5;
  return 4;
}
function channelPoints(n){n=Number(n||0);if(n>=8)return 8;if(n>=6)return 7;if(n>=2)return 5;if(n===1)return 4;return 2}
function targetBitrate(r){
  const w=Number(r.width||0),h=Number(r.height||0),c=norm(r.video_codec),efficient=c.includes('hevc')||c.includes('h265')||c.includes('av1');
  if(w>=3000||h>=1800)return efficient?10000:18000;
  if(w>=1800||h>=790)return efficient?3500:6500;
  if(w>=1200||h>=650)return efficient?2200:3500;
  if(h>=430)return efficient?1000:1600;
  return efficient?700:1100;
}
export function scoreMovie(r){
  const bp=Number(r.video_stream_bitrate||r.bitrate||0),target=targetBitrate(r);
  const bitrate=clamp(Math.round(18*(bp/target)),3,18);
  const bitDepth=Number(r.bit_depth||0)>=10?3:1;
  const hdr=r.dynamic_range?2:0;
  const image=resolutionPoints(r)+bitrate+videoCodecPoints(r)+bitDepth+hdr;
  const audio=audioCodecPoints(r.audio_stream_codec||r.audio_codec,r.audio_stream_profile||r.audio_profile)+channelPoints(r.audio_stream_channels||r.audio_channels)+clamp(Math.round(Number(r.audio_stream_bitrate||0)/256),0,4);
  const integrity=(Number(r.file_size_bytes||0)>0?4:0)+(Number(r.duration_ms||0)>0?4:0)+(r.rating_key?2:0);
  const extras=(r.container?2:0)+(r.video_profile?1:0)+(r.video_frame_rate?1:0)+(r.bit_depth?1:0);
  return clamp(image+audio+integrity+extras,0,100);
}
export function scoreEpisode(r,seasonMedian=null){
  let base=scoreMovie(r);
  const res=resolutionPoints(r);
  base+=Math.round((24-res)*0.45);
  if(seasonMedian!=null){const delta=Number(r.bitrate||0)/(Number(seasonMedian)||1);if(delta<.45)base-=10;else if(delta<.65)base-=5;}
  return clamp(base,0,100);
}
export function band(s){return s>=85?'excellent':s>=75?'very_good':s>=60?'correct':s>=40?'improvable':'deficient'}

export async function ensureQualitySchema(){
  const sql=db();
  await sql`CREATE TABLE IF NOT EXISTS piko_quality (rating_key text PRIMARY KEY,item_type text NOT NULL,score integer,band text,confidence text NOT NULL DEFAULT 'medium',formula_version text NOT NULL,status text NOT NULL DEFAULT 'pending',components jsonb NOT NULL DEFAULT '{}'::jsonb,source_fingerprint text,enriched_at timestamptz,evaluated_at timestamptz,updated_at timestamptz NOT NULL DEFAULT now())`;
  await sql`ALTER TABLE piko_quality ADD COLUMN IF NOT EXISTS last_error text`;
  await sql`CREATE TABLE IF NOT EXISTS plex_streams (rating_key text NOT NULL,media_index integer NOT NULL,part_index integer NOT NULL,stream_index integer NOT NULL,stream_type integer,codec text,profile text,bitrate integer,bit_depth integer,dynamic_range text,color_space text,chroma text,channels integer,language text,is_selected boolean,is_default boolean,is_forced boolean,raw jsonb NOT NULL DEFAULT '{}'::jsonb,updated_at timestamptz NOT NULL DEFAULT now(),PRIMARY KEY(rating_key,media_index,part_index,stream_index))`;
  await sql`CREATE TABLE IF NOT EXISTS piko_quality_aggregates (entity_type text NOT NULL,entity_key text NOT NULL,parent_key text,season_index integer,score integer,band text,analyzed_count integer NOT NULL DEFAULT 0,total_count integer NOT NULL DEFAULT 0,formula_version text NOT NULL,updated_at timestamptz NOT NULL DEFAULT now(),PRIMARY KEY(entity_type,entity_key))`;
  await sql`CREATE INDEX IF NOT EXISTS idx_piko_quality_status ON piko_quality(status)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_piko_quality_fp ON piko_quality(source_fingerprint)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_plex_streams_rating ON plex_streams(rating_key)`;
  /* Preserva el progreso de la primera carga ya iniciada antes de introducir fingerprints. */
  await sql`UPDATE piko_quality q SET source_fingerprint=p.fingerprint FROM plex_items p WHERE q.rating_key=p.rating_key AND q.source_fingerprint IS NULL AND q.formula_version=${QUALITY_VERSION} AND q.status='evaluated'`;
}

async function startRun(jobType,summary={}){
  const sql=db();
  await sql`UPDATE pipeline_runs SET status='failed',finished_at=now(),updated_at=now(),summary=COALESCE(summary,'{}'::jsonb)||${JSON.stringify({reason:'stale_running_recovered'})}::jsonb WHERE job_type=${jobType} AND status='running' AND started_at<now()-interval '15 minutes'`;
  const [r]=await sql`INSERT INTO pipeline_runs(job_type,source,status,started_at,processed_count,added_count,updated_count,skipped_count,error_count,summary,created_at,updated_at) VALUES(${jobType},'frontend','running',now(),0,0,0,0,0,${JSON.stringify(summary)}::jsonb,now(),now()) RETURNING id`;
  return r.id;
}
async function finishRun(id,status,counts={},summary={}){
  const sql=db();
  await sql`UPDATE pipeline_runs SET status=${status},finished_at=now(),processed_count=${Number(counts.processed||0)},added_count=${Number(counts.added||0)},updated_count=${Number(counts.updated||0)},skipped_count=${Number(counts.skipped||0)},error_count=${Number(counts.errors||0)},summary=${JSON.stringify(summary)}::jsonb,updated_at=now() WHERE id=${id}`;
}

export async function processABatch(limit=DEFAULT_A_BATCH){
  await ensureQualitySchema();
  const sql=db(),batch=Math.max(1,Math.min(10000,Number(limit)||DEFAULT_A_BATCH));
  const runId=await startRun('pikoquality_a',{formulaVersion:QUALITY_VERSION,batch});
  try{
    const rows=await sql`
      WITH season_stats AS (
        SELECT p.grandparent_rating_key,p.parent_index,percentile_cont(0.5) WITHIN GROUP (ORDER BY m.bitrate) AS median_bitrate
        FROM plex_items p JOIN plex_media m ON m.rating_key=p.rating_key AND m.media_index=0
        WHERE p.active AND p.item_type='episode' AND m.bitrate IS NOT NULL
        GROUP BY p.grandparent_rating_key,p.parent_index
      )
      SELECT p.rating_key,p.item_type,p.fingerprint,p.grandparent_rating_key,p.parent_index,m.resolution,m.width,m.height,m.bitrate,m.video_codec,m.video_profile,m.video_frame_rate,m.audio_codec,m.audio_profile,m.audio_channels,m.container,f.file_size_bytes,f.duration_ms,ss.median_bitrate season_median
      FROM plex_items p
      JOIN plex_media m ON m.rating_key=p.rating_key AND m.media_index=0
      LEFT JOIN plex_files f ON f.rating_key=p.rating_key AND f.media_index=0 AND f.part_index=0
      LEFT JOIN piko_quality q ON q.rating_key=p.rating_key
      LEFT JOIN season_stats ss ON ss.grandparent_rating_key=p.grandparent_rating_key AND ss.parent_index=p.parent_index
      WHERE p.active AND p.item_type IN ('movie','episode') AND (
        q.rating_key IS NULL OR
        (q.status<>'stale' AND (q.formula_version<>${QUALITY_VERSION} OR q.source_fingerprint IS DISTINCT FROM p.fingerprint)) OR
        (q.status='stale' AND q.source_fingerprint IS DISTINCT FROM p.fingerprint)
      )
      ORDER BY p.rating_key
      LIMIT ${batch}`;
    if(!rows.length){await finishRun(runId,'success',{processed:0},{formulaVersion:QUALITY_VERSION,batch,remaining:0,message:'No había pendientes A'});return{processed:0,remaining:0};}
    const payload=rows.map(r=>{const score=r.item_type==='episode'?scoreEpisode(r,r.season_median):scoreMovie(r);return{rating_key:r.rating_key,item_type:r.item_type,score,band:band(score),confidence:'medium',formula_version:QUALITY_VERSION,status:'evaluated',source_fingerprint:r.fingerprint};});
    await sql`
      WITH x AS (SELECT * FROM jsonb_to_recordset(${JSON.stringify(payload)}::jsonb) AS t(rating_key text,item_type text,score int,band text,confidence text,formula_version text,status text,source_fingerprint text))
      INSERT INTO piko_quality(rating_key,item_type,score,band,confidence,formula_version,status,source_fingerprint,enriched_at,last_error,evaluated_at,updated_at)
      SELECT rating_key,item_type,score,band,confidence,formula_version,status,source_fingerprint,NULL,NULL,now(),now() FROM x
      ON CONFLICT(rating_key) DO UPDATE SET item_type=EXCLUDED.item_type,score=EXCLUDED.score,band=EXCLUDED.band,confidence='medium',formula_version=EXCLUDED.formula_version,status='evaluated',source_fingerprint=EXCLUDED.source_fingerprint,enriched_at=NULL,last_error=NULL,evaluated_at=now(),updated_at=now()`;
    const [left]=await sql`SELECT count(*)::int n FROM plex_items p JOIN plex_media m ON m.rating_key=p.rating_key AND m.media_index=0 LEFT JOIN piko_quality q ON q.rating_key=p.rating_key WHERE p.active AND p.item_type IN('movie','episode') AND (q.rating_key IS NULL OR (q.status<>'stale' AND (q.formula_version<>${QUALITY_VERSION} OR q.source_fingerprint IS DISTINCT FROM p.fingerprint)) OR (q.status='stale' AND q.source_fingerprint IS DISTINCT FROM p.fingerprint))`;
    await finishRun(runId,'success',{processed:payload.length,updated:payload.length},{formulaVersion:QUALITY_VERSION,batch,remaining:left.n});
    return{processed:payload.length,remaining:left.n};
  }catch(e){await finishRun(runId,'failed',{errors:1},{formulaVersion:QUALITY_VERSION,error:String(e?.message||e)});throw e;}
}

export async function rebuildAggregates(){
  await ensureQualitySchema();
  const sql=db(),runId=await startRun('pikoquality_aggregates',{formulaVersion:QUALITY_VERSION});
  try{
    await sql`DELETE FROM piko_quality_aggregates`;
    const seasons=await sql`
      WITH scored AS (
        SELECT p.grandparent_rating_key,p.parent_index,q.score
        FROM plex_items p JOIN piko_quality q ON q.rating_key=p.rating_key
        WHERE p.active AND p.item_type='episode' AND q.status='evaluated' AND q.formula_version=${QUALITY_VERSION} AND q.source_fingerprint=p.fingerprint
      ), totals AS (
        SELECT grandparent_rating_key,parent_index,CAST(count(*) AS integer) total_count FROM plex_items WHERE active AND item_type='episode' GROUP BY grandparent_rating_key,parent_index
      ), agg AS (
        SELECT grandparent_rating_key,parent_index,CAST(count(*) AS integer) analyzed_count,
          CAST(round(CAST(0.75*percentile_cont(0.5) WITHIN GROUP(ORDER BY score)+0.25*percentile_cont(0.1) WITHIN GROUP(ORDER BY score) AS numeric)) AS integer) score
        FROM scored GROUP BY grandparent_rating_key,parent_index
      )
      SELECT a.grandparent_rating_key,a.parent_index,a.analyzed_count,t.total_count,a.score FROM agg a JOIN totals t USING(grandparent_rating_key,parent_index)`;
    if(seasons.length){const payload=seasons.map(r=>({entity_type:'season',entity_key:`${r.grandparent_rating_key}:${r.parent_index}`,parent_key:r.grandparent_rating_key,season_index:r.parent_index,score:r.score,band:band(r.score),analyzed_count:r.analyzed_count,total_count:r.total_count,formula_version:QUALITY_VERSION}));await sql`WITH x AS (SELECT * FROM jsonb_to_recordset(${JSON.stringify(payload)}::jsonb) AS t(entity_type text,entity_key text,parent_key text,season_index int,score int,band text,analyzed_count int,total_count int,formula_version text)) INSERT INTO piko_quality_aggregates(entity_type,entity_key,parent_key,season_index,score,band,analyzed_count,total_count,formula_version,updated_at) SELECT entity_type,entity_key,parent_key,season_index,score,band,analyzed_count,total_count,formula_version,now() FROM x`;}
    const shows=await sql`
      WITH scored AS (
        SELECT p.grandparent_rating_key,q.score FROM plex_items p JOIN piko_quality q ON q.rating_key=p.rating_key WHERE p.active AND p.item_type='episode' AND q.status='evaluated' AND q.formula_version=${QUALITY_VERSION} AND q.source_fingerprint=p.fingerprint
      ), totals AS (SELECT grandparent_rating_key,CAST(count(*) AS integer) total_count FROM plex_items WHERE active AND item_type='episode' GROUP BY grandparent_rating_key),
      agg AS (
        SELECT grandparent_rating_key,CAST(count(*) AS integer) analyzed_count,
          CAST(round(CAST(0.75*percentile_cont(0.5) WITHIN GROUP(ORDER BY score)+0.25*percentile_cont(0.1) WITHIN GROUP(ORDER BY score) AS numeric)) AS integer) score
        FROM scored GROUP BY grandparent_rating_key
      )
      SELECT a.grandparent_rating_key,a.analyzed_count,t.total_count,a.score FROM agg a JOIN totals t USING(grandparent_rating_key)`;
    if(shows.length){const payload=shows.map(r=>({entity_type:'show',entity_key:String(r.grandparent_rating_key),parent_key:null,season_index:null,score:r.score,band:band(r.score),analyzed_count:r.analyzed_count,total_count:r.total_count,formula_version:QUALITY_VERSION}));await sql`WITH x AS (SELECT * FROM jsonb_to_recordset(${JSON.stringify(payload)}::jsonb) AS t(entity_type text,entity_key text,parent_key text,season_index int,score int,band text,analyzed_count int,total_count int,formula_version text)) INSERT INTO piko_quality_aggregates(entity_type,entity_key,parent_key,season_index,score,band,analyzed_count,total_count,formula_version,updated_at) SELECT entity_type,entity_key,parent_key,season_index,score,band,analyzed_count,total_count,formula_version,now() FROM x`;}
    await finishRun(runId,'success',{processed:seasons.length+shows.length,updated:seasons.length+shows.length},{formulaVersion:QUALITY_VERSION,seasons:seasons.length,shows:shows.length});
    return{seasons:seasons.length,shows:shows.length};
  }catch(e){await finishRun(runId,'failed',{errors:1},{formulaVersion:QUALITY_VERSION,error:String(e?.message||e)});throw e;}
}

export async function qualitySummary(){
  await ensureQualitySchema();
  const sql=db();
  const [counts]=await sql`
    WITH physical AS (
      SELECT p.rating_key,p.item_type,p.fingerprint FROM plex_items p JOIN plex_media m ON m.rating_key=p.rating_key AND m.media_index=0 WHERE p.active AND p.item_type IN('movie','episode')
    ), joined AS (
      SELECT p.*,q.status,q.formula_version,q.source_fingerprint FROM physical p LEFT JOIN piko_quality q ON q.rating_key=p.rating_key
    )
    SELECT
      CAST(count(*) AS integer) total,
      CAST(count(*) FILTER(WHERE status='evaluated' AND formula_version=${QUALITY_VERSION} AND source_fingerprint=fingerprint) AS integer) evaluated,
      CAST(count(*) FILTER(WHERE status='stale') AS integer) stale,
      CAST(count(*) FILTER(WHERE status='pending' OR status IS NULL OR formula_version<>${QUALITY_VERSION} OR source_fingerprint IS DISTINCT FROM fingerprint) AS integer) pending
    FROM joined`;
  return counts;
}
