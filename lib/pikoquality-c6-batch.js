import 'server-only';
import {db} from './db';
import {PIKOQUALITY_C6_VERSION,scorePikoQualityC6,c6Band} from './pikoquality-c6-core.mjs';
export const C6_BATCH_SIZE=1000;

async function pendingCount(sql){const [r]=await sql`SELECT count(*)::int n FROM plex_items p JOIN plex_technical_state s ON s.rating_key=p.rating_key AND s.snapshot_status='ready' AND s.technical_fingerprint IS NOT NULL LEFT JOIN piko_quality q ON q.rating_key=p.rating_key WHERE p.active AND p.item_type IN('movie','episode') AND NOT COALESCE(q.status='evaluated' AND q.formula_version=${PIKOQUALITY_C6_VERSION} AND q.source_fingerprint IS NOT DISTINCT FROM s.technical_fingerprint,false)`;return Number(r?.n||0)}

export async function getC6BatchState(sql=db()){
  const [r]=await sql`SELECT count(*)::int total,count(*) FILTER(WHERE COALESCE(q.status='evaluated' AND q.formula_version=${PIKOQUALITY_C6_VERSION} AND q.source_fingerprint IS NOT DISTINCT FROM s.technical_fingerprint,false))::int current,count(*) FILTER(WHERE NOT COALESCE(q.status='evaluated' AND q.formula_version=${PIKOQUALITY_C6_VERSION} AND q.source_fingerprint IS NOT DISTINCT FROM s.technical_fingerprint,false))::int pending,count(*) FILTER(WHERE q.rating_key IS NULL OR q.formula_version IS DISTINCT FROM ${PIKOQUALITY_C6_VERSION})::int never_c6,count(*) FILTER(WHERE q.formula_version=${PIKOQUALITY_C6_VERSION} AND q.source_fingerprint IS DISTINCT FROM s.technical_fingerprint)::int changed,count(*) FILTER(WHERE q.formula_version=${PIKOQUALITY_C6_VERSION} AND q.status='error')::int errors FROM plex_items p JOIN plex_technical_state s ON s.rating_key=p.rating_key AND s.snapshot_status='ready' AND s.technical_fingerprint IS NOT NULL LEFT JOIN piko_quality q ON q.rating_key=p.rating_key WHERE p.active AND p.item_type IN('movie','episode')`;
  const [last]=await sql`SELECT run_id AS id,technical_status AS status,started_at,finished_at,items_processed AS processed_count,error_count,metrics AS summary,round(extract(epoch from (COALESCE(finished_at,now())-COALESCE(started_at,requested_at)))::numeric,3) duration_seconds FROM process_runs WHERE process_code='PROC-PQ-001' ORDER BY requested_at DESC LIMIT 1`;
  return{version:PIKOQUALITY_C6_VERSION,batchSize:C6_BATCH_SIZE,total:Number(r?.total||0),current:Number(r?.current||0),pending:Number(r?.pending||0),neverC6:Number(r?.never_c6||0),changed:Number(r?.changed||0),errors:Number(r?.errors||0),lastRun:last||null};
}

export async function rebuildC6Aggregates(sql=db()){
  const validEpisode=`q.status='evaluated' AND q.formula_version='${PIKOQUALITY_C6_VERSION.replaceAll("'","''")}' AND q.source_fingerprint IS NOT DISTINCT FROM pts.technical_fingerprint`;
  const seasons=await sql.query(`
    WITH scored AS (
      SELECT p.grandparent_rating_key,p.parent_index,q.score
      FROM plex_items p
      JOIN plex_technical_state pts ON pts.rating_key=p.rating_key AND pts.snapshot_status='ready'
      JOIN piko_quality q ON q.rating_key=p.rating_key
      WHERE p.active AND p.item_type='episode' AND ${validEpisode}
    ), totals AS (
      SELECT grandparent_rating_key,parent_index,count(*)::int total_count
      FROM plex_items WHERE active AND item_type='episode'
      GROUP BY grandparent_rating_key,parent_index
    )
    SELECT s.grandparent_rating_key,s.parent_index,count(*)::int analyzed_count,t.total_count,
      round((0.75*percentile_cont(0.5) WITHIN GROUP(ORDER BY s.score)+0.25*percentile_cont(0.1) WITHIN GROUP(ORDER BY s.score))::numeric)::int score
    FROM scored s JOIN totals t USING(grandparent_rating_key,parent_index)
    GROUP BY s.grandparent_rating_key,s.parent_index,t.total_count`);
  if(seasons.length){
    const payload=seasons.map(r=>({entity_type:'season',entity_key:`${r.grandparent_rating_key}:${r.parent_index}`,parent_key:String(r.grandparent_rating_key),season_index:Number(r.parent_index),score:Number(r.score),band:c6Band(Number(r.score)),analyzed_count:Number(r.analyzed_count),total_count:Number(r.total_count),formula_version:PIKOQUALITY_C6_VERSION}));
    await sql`WITH x AS(SELECT * FROM jsonb_to_recordset(${JSON.stringify(payload)}::jsonb) AS t(entity_type text,entity_key text,parent_key text,season_index int,score int,band text,analyzed_count int,total_count int,formula_version text)) INSERT INTO piko_quality_aggregates(entity_type,entity_key,parent_key,season_index,score,band,analyzed_count,total_count,formula_version,updated_at) SELECT entity_type,entity_key,parent_key,season_index,score,band,analyzed_count,total_count,formula_version,now() FROM x ON CONFLICT(entity_type,entity_key) DO UPDATE SET parent_key=EXCLUDED.parent_key,season_index=EXCLUDED.season_index,score=EXCLUDED.score,band=EXCLUDED.band,analyzed_count=EXCLUDED.analyzed_count,total_count=EXCLUDED.total_count,formula_version=EXCLUDED.formula_version,updated_at=now()`;
  }
  const shows=await sql.query(`
    WITH scored AS (
      SELECT p.grandparent_rating_key,q.score
      FROM plex_items p
      JOIN plex_technical_state pts ON pts.rating_key=p.rating_key AND pts.snapshot_status='ready'
      JOIN piko_quality q ON q.rating_key=p.rating_key
      WHERE p.active AND p.item_type='episode' AND ${validEpisode}
    ), totals AS (
      SELECT grandparent_rating_key,count(*)::int total_count
      FROM plex_items WHERE active AND item_type='episode'
      GROUP BY grandparent_rating_key
    )
    SELECT s.grandparent_rating_key,count(*)::int analyzed_count,t.total_count,
      round((0.75*percentile_cont(0.5) WITHIN GROUP(ORDER BY s.score)+0.25*percentile_cont(0.1) WITHIN GROUP(ORDER BY s.score))::numeric)::int score
    FROM scored s JOIN totals t USING(grandparent_rating_key)
    GROUP BY s.grandparent_rating_key,t.total_count`);
  if(shows.length){
    const payload=shows.map(r=>({entity_type:'show',entity_key:String(r.grandparent_rating_key),parent_key:null,season_index:null,score:Number(r.score),band:c6Band(Number(r.score)),analyzed_count:Number(r.analyzed_count),total_count:Number(r.total_count),formula_version:PIKOQUALITY_C6_VERSION}));
    await sql`WITH x AS(SELECT * FROM jsonb_to_recordset(${JSON.stringify(payload)}::jsonb) AS t(entity_type text,entity_key text,parent_key text,season_index int,score int,band text,analyzed_count int,total_count int,formula_version text)) INSERT INTO piko_quality_aggregates(entity_type,entity_key,parent_key,season_index,score,band,analyzed_count,total_count,formula_version,updated_at) SELECT entity_type,entity_key,parent_key,season_index,score,band,analyzed_count,total_count,formula_version,now() FROM x ON CONFLICT(entity_type,entity_key) DO UPDATE SET parent_key=EXCLUDED.parent_key,season_index=EXCLUDED.season_index,score=EXCLUDED.score,band=EXCLUDED.band,analyzed_count=EXCLUDED.analyzed_count,total_count=EXCLUDED.total_count,formula_version=EXCLUDED.formula_version,updated_at=now()`;
  }
  return{seasons:seasons.length,shows:shows.length,version:PIKOQUALITY_C6_VERSION};
}

export async function processC6Batch(limit=C6_BATCH_SIZE){
  const sql=db(),batch=Math.max(1,Math.min(C6_BATCH_SIZE,Number(limit)||C6_BATCH_SIZE)),started=Date.now();
  const rows=await sql`SELECT p.rating_key,p.item_type,p.plex_year,s.technical_fingerprint,m.width,m.height,m.bitrate,m.video_codec,m.video_profile,f.file_size_bytes,f.duration_ms,vs.bit_depth,COALESCE(vs.bitrate,m.bitrate) video_bitrate,aus.codec audio_codec,aus.channels audio_channels,aus.bitrate audio_bitrate FROM plex_items p JOIN plex_technical_state s ON s.rating_key=p.rating_key AND s.snapshot_status='ready' AND s.technical_fingerprint IS NOT NULL LEFT JOIN piko_quality q ON q.rating_key=p.rating_key LEFT JOIN LATERAL(SELECT pm.* FROM plex_media pm WHERE pm.rating_key=p.rating_key ORDER BY pm.bitrate DESC NULLS LAST,pm.media_index LIMIT 1)m ON true LEFT JOIN LATERAL(SELECT pf.* FROM plex_files pf WHERE pf.rating_key=p.rating_key ORDER BY pf.file_size_bytes DESC NULLS LAST,pf.media_index,pf.part_index LIMIT 1)f ON true LEFT JOIN LATERAL(SELECT ps.bit_depth,ps.bitrate FROM plex_streams ps WHERE ps.rating_key=p.rating_key AND ps.stream_type=1 ORDER BY ps.bitrate DESC NULLS LAST,ps.stream_index LIMIT 1)vs ON true LEFT JOIN LATERAL(SELECT ps.codec,ps.channels,ps.bitrate FROM plex_streams ps WHERE ps.rating_key=p.rating_key AND ps.stream_type=2 ORDER BY ps.channels DESC NULLS LAST,ps.bitrate DESC NULLS LAST,ps.stream_index LIMIT 1)aus ON true WHERE p.active AND p.item_type IN('movie','episode') AND NOT COALESCE(q.status='evaluated' AND q.formula_version=${PIKOQUALITY_C6_VERSION} AND q.source_fingerprint IS NOT DISTINCT FROM s.technical_fingerprint,false) ORDER BY p.rating_key LIMIT ${batch}`;
  if(!rows.length){
    const elapsedMs=Date.now()-started,aggregates=await rebuildC6Aggregates(sql);
    return{processed:0,remaining:0,elapsedMs,itemsPerSecond:0,version:PIKOQUALITY_C6_VERSION,aggregates};
  }
  const payload=rows.map(r=>{const x=scorePikoQualityC6(r);return{rating_key:String(r.rating_key),item_type:r.item_type,score:x.scoreCompat,band:x.band,confidence:'high',formula_version:PIKOQUALITY_C6_VERSION,status:'evaluated',source_fingerprint:r.technical_fingerprint,components:x.components}});
  await sql`WITH x AS (SELECT * FROM jsonb_to_recordset(${JSON.stringify(payload)}::jsonb) AS t(rating_key text,item_type text,score int,band text,confidence text,formula_version text,status text,source_fingerprint text,components jsonb)) INSERT INTO piko_quality(rating_key,item_type,score,band,confidence,formula_version,status,source_fingerprint,components,enriched_at,last_error,evaluated_at,updated_at) SELECT rating_key,item_type,score,band,confidence,formula_version,status,source_fingerprint,components,now(),NULL,now(),now() FROM x ON CONFLICT(rating_key) DO UPDATE SET item_type=EXCLUDED.item_type,score=EXCLUDED.score,band=EXCLUDED.band,confidence=EXCLUDED.confidence,formula_version=EXCLUDED.formula_version,status='evaluated',source_fingerprint=EXCLUDED.source_fingerprint,components=EXCLUDED.components,enriched_at=now(),last_error=NULL,evaluated_at=now(),updated_at=now()`;
  const remaining=await pendingCount(sql),elapsedMs=Date.now()-started,itemsPerSecond=elapsedMs?Math.round(payload.length/(elapsedMs/1000)):0,aggregates=remaining===0?await rebuildC6Aggregates(sql):null;
  return{processed:payload.length,remaining,elapsedMs,itemsPerSecond,version:PIKOQUALITY_C6_VERSION,aggregates};
}
