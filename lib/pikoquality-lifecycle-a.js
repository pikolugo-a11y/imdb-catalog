import 'server-only';
import {db} from './db';
import {ensureQualitySchema,scoreMovie,scoreEpisode,band,QUALITY_VERSION,DEFAULT_A_BATCH} from './pikoquality';
import {getLifecycleForIds} from './lifecycle';

async function startRun(summary){const sql=db();await sql`UPDATE pipeline_runs SET status='failed',finished_at=now(),updated_at=now(),summary=COALESCE(summary,'{}'::jsonb)||${JSON.stringify({reason:'stale_running_recovered'})}::jsonb WHERE job_type='pikoquality_a' AND status='running' AND started_at<now()-interval '15 minutes'`;const[r]=await sql`INSERT INTO pipeline_runs(job_type,source,status,started_at,processed_count,added_count,updated_count,skipped_count,error_count,summary,created_at,updated_at) VALUES('pikoquality_a','frontend','running',now(),0,0,0,0,0,${JSON.stringify(summary)}::jsonb,now(),now()) RETURNING id`;return r.id;}
async function finishRun(id,status,counts={},summary={}){const sql=db();await sql`UPDATE pipeline_runs SET status=${status},finished_at=now(),processed_count=${Number(counts.processed||0)},added_count=${Number(counts.added||0)},updated_count=${Number(counts.updated||0)},skipped_count=${Number(counts.skipped||0)},error_count=${Number(counts.errors||0)},summary=${JSON.stringify(summary)}::jsonb,updated_at=now() WHERE id=${id}`;}

export async function processLifecycleABatch(limit=DEFAULT_A_BATCH){
  await ensureQualitySchema();
  const sql=db(),batch=Math.max(1,Math.min(10000,Number(limit)||DEFAULT_A_BATCH)),runId=await startRun({formulaVersion:QUALITY_VERSION,batch,lifecycleGate:true});
  try{
    const candidates=await sql`
      WITH season_stats AS (
        SELECT p.grandparent_rating_key,p.parent_index,percentile_cont(0.5) WITHIN GROUP (ORDER BY m.bitrate) AS median_bitrate
        FROM plex_items p JOIN plex_media m ON m.rating_key=p.rating_key AND m.media_index=0
        WHERE p.active AND p.item_type='episode' AND m.bitrate IS NOT NULL GROUP BY p.grandparent_rating_key,p.parent_index
      )
      SELECT p.rating_key,p.item_type,p.fingerprint,p.grandparent_rating_key,p.parent_index,m.resolution,m.width,m.height,m.bitrate,m.video_codec,m.video_profile,m.video_frame_rate,m.audio_codec,m.audio_profile,m.audio_channels,m.container,f.file_size_bytes,f.duration_ms,ss.median_bitrate season_median,COALESCE(mx.external_id,sr.imdb_id) lifecycle_imdb_id
      FROM plex_items p JOIN plex_media m ON m.rating_key=p.rating_key AND m.media_index=0
      LEFT JOIN plex_files f ON f.rating_key=p.rating_key AND f.media_index=0 AND f.part_index=0
      LEFT JOIN piko_quality q ON q.rating_key=p.rating_key
      LEFT JOIN season_stats ss ON ss.grandparent_rating_key=p.grandparent_rating_key AND ss.parent_index=p.parent_index
      LEFT JOIN LATERAL(SELECT external_id FROM plex_external_ids WHERE rating_key=p.rating_key AND provider='imdb' LIMIT 1) mx ON p.item_type='movie'
      LEFT JOIN series_reference sr ON p.item_type='episode' AND sr.show_rating_key=p.grandparent_rating_key
      WHERE p.active AND p.item_type IN('movie','episode') AND (q.rating_key IS NULL OR (q.status<>'stale' AND (q.formula_version<>${QUALITY_VERSION} OR q.source_fingerprint IS DISTINCT FROM p.fingerprint)) OR (q.status='stale' AND q.source_fingerprint IS DISTINCT FROM p.fingerprint))
      ORDER BY p.rating_key LIMIT ${batch*10}`;
    const lifecycle=await getLifecycleForIds([...new Set(candidates.map(r=>r.lifecycle_imdb_id).filter(Boolean))]),allowed=new Set(['TECH_PENDING','TECH_REVIEW','COMPLETE']);
    const rows=candidates.filter(r=>allowed.has(lifecycle.get(r.lifecycle_imdb_id)?.state)).slice(0,batch),blocked=candidates.length-rows.length;
    if(!rows.length){await finishRun(runId,'success',{processed:0,skipped:blocked},{formulaVersion:QUALITY_VERSION,batch,lifecycleGate:true,blockedByLifecycle:blocked,remaining:0,message:'No había pendientes A elegibles por ciclo de vida'});return{processed:0,blocked,remaining:0};}
    const payload=rows.map(r=>{const score=r.item_type==='episode'?scoreEpisode(r,r.season_median):scoreMovie(r);return{rating_key:r.rating_key,item_type:r.item_type,score,band:band(score),confidence:'medium',formula_version:QUALITY_VERSION,status:'evaluated',source_fingerprint:r.fingerprint};});
    await sql`WITH x AS (SELECT * FROM jsonb_to_recordset(${JSON.stringify(payload)}::jsonb) AS t(rating_key text,item_type text,score int,band text,confidence text,formula_version text,status text,source_fingerprint text)) INSERT INTO piko_quality(rating_key,item_type,score,band,confidence,formula_version,status,source_fingerprint,enriched_at,last_error,evaluated_at,updated_at) SELECT rating_key,item_type,score,band,confidence,formula_version,status,source_fingerprint,NULL,NULL,now(),now() FROM x ON CONFLICT(rating_key) DO UPDATE SET item_type=EXCLUDED.item_type,score=EXCLUDED.score,band=EXCLUDED.band,confidence='medium',formula_version=EXCLUDED.formula_version,status='evaluated',source_fingerprint=EXCLUDED.source_fingerprint,enriched_at=NULL,last_error=NULL,evaluated_at=now(),updated_at=now()`;
    await finishRun(runId,'success',{processed:payload.length,updated:payload.length,skipped:blocked},{formulaVersion:QUALITY_VERSION,batch,lifecycleGate:true,blockedByLifecycle:blocked});
    return{processed:payload.length,blocked,remaining:Math.max(0,candidates.length-rows.length)};
  }catch(e){await finishRun(runId,'failed',{errors:1},{formulaVersion:QUALITY_VERSION,lifecycleGate:true,error:String(e?.message||e)});throw e;}
}
