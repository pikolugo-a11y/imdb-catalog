import 'server-only';
import {db} from './db';
import {getMovieQualitySettings} from './movie-quality-settings';

export async function getMovieQualitySummary(sql=db()){
  const [pending]=await sql`SELECT count(*)::int total FROM catalog_lifecycle WHERE lifecycle_state='MOVIE_FILE_PENDING'`;
  const [review]=await sql`SELECT count(DISTINCT f.imdb_id)::int affected,count(*)::int findings,count(*) FILTER(WHERE f.risk_score>=65)::int priority,max(f.last_seen_at) last_analysis FROM movie_quality_findings f JOIN catalog_lifecycle cl ON cl.imdb_id=f.imdb_id AND cl.lifecycle_state='MOVIE_FILE_REVIEW' WHERE f.status='pending' AND f.finding_type IN('duration','filename','duplicate')`;
  const types=await sql`SELECT f.finding_type,count(*)::int total,count(DISTINCT f.rating_key)::int affected FROM movie_quality_findings f JOIN catalog_lifecycle cl ON cl.imdb_id=f.imdb_id AND cl.lifecycle_state='MOVIE_FILE_REVIEW' WHERE f.status='pending' AND f.finding_type IN('duration','filename','duplicate') GROUP BY f.finding_type ORDER BY f.finding_type`;
  const pendingCount=Number(pending?.total||0),reviewAffected=Number(review?.affected||0);
  return{pending_analysis:pendingCount,review_affected:reviewAffected,affected:pendingCount+reviewAffected,pending:Number(review?.findings||0),priority:Number(review?.priority||0),last_analysis:review?.last_analysis||null,types};
}

export async function getMovieQualityDashboard(filters={}){
  const sql=db(),q=String(filters.q||'').trim().toLowerCase(),type=String(filters.type||''),risk=String(filters.risk||''),page=Math.max(1,Number(filters.page)||1),pageSize=10,offset=(page-1)*pageSize;
  const rows=await sql`
    WITH open_cases AS (
      SELECT
        'pending_analysis'::text case_kind,NULL::bigint id,NULL::text finding_type,'pending'::text severity,0::int risk_score,'pending'::text status,'{}'::jsonb details,
        NULL::timestamptz first_seen_at,cl.state_changed_at last_seen_at,cl.imdb_id,p.rating_key,p.plex_title,p.plex_year,
        pm.resolution,pm.bitrate,pm.width,pm.height,pm.video_codec,pm.audio_codec,pm.audio_channels,pf.file_path,pf.file_size_bytes,c.poster_path,
        pq.score pikoquality_score,pq.band pikoquality_band
      FROM catalog_lifecycle cl
      JOIN plex_catalog_status pcs ON pcs.imdb_id=cl.imdb_id AND pcs.status='in_plex'
      JOIN plex_items p ON p.rating_key=pcs.rating_key AND p.active AND p.item_type='movie'
      LEFT JOIN LATERAL(SELECT * FROM plex_media z WHERE z.rating_key=p.rating_key ORDER BY media_index LIMIT 1)pm ON true
      LEFT JOIN LATERAL(SELECT * FROM plex_files z WHERE z.rating_key=p.rating_key ORDER BY media_index,part_index LIMIT 1)pf ON true
      LEFT JOIN catalog_read_model c ON c.imdb_id=cl.imdb_id
      LEFT JOIN piko_quality pq ON pq.rating_key=p.rating_key
      WHERE cl.lifecycle_state='MOVIE_FILE_PENDING'
      UNION ALL
      SELECT
        'review'::text case_kind,f.id,f.finding_type,f.severity,f.risk_score,f.status,f.details,f.first_seen_at,f.last_seen_at,f.imdb_id,p.rating_key,p.plex_title,p.plex_year,
        pm.resolution,pm.bitrate,pm.width,pm.height,pm.video_codec,pm.audio_codec,pm.audio_channels,pf.file_path,pf.file_size_bytes,c.poster_path,
        pq.score pikoquality_score,pq.band pikoquality_band
      FROM movie_quality_findings f
      JOIN catalog_lifecycle cl ON cl.imdb_id=f.imdb_id AND cl.lifecycle_state='MOVIE_FILE_REVIEW'
      JOIN plex_items p ON p.rating_key=f.rating_key AND p.active
      LEFT JOIN LATERAL(SELECT * FROM plex_media z WHERE z.rating_key=p.rating_key ORDER BY media_index LIMIT 1)pm ON true
      LEFT JOIN LATERAL(SELECT * FROM plex_files z WHERE z.rating_key=p.rating_key ORDER BY media_index,part_index LIMIT 1)pf ON true
      LEFT JOIN catalog_read_model c ON c.imdb_id=f.imdb_id
      LEFT JOIN piko_quality pq ON pq.rating_key=f.rating_key
      WHERE f.status='pending' AND f.finding_type IN('duration','filename','duplicate')
    )
    SELECT *,count(*) OVER()::int total_count FROM open_cases
    WHERE (${type}='' OR (case_kind='review' AND finding_type=${type}))
      AND (${risk}='' OR (${risk}='high' AND case_kind='review' AND risk_score>=65))
      AND (${q}='' OR lower(COALESCE(plex_title,'')) LIKE ${'%'+q+'%'})
    ORDER BY CASE WHEN case_kind='pending_analysis' THEN 0 ELSE 1 END,risk_score DESC,last_seen_at DESC NULLS LAST
    LIMIT ${pageSize} OFFSET ${offset}`;
  const total=rows[0]?.total_count||0;
  const [summary,settings]=await Promise.all([getMovieQualitySummary(sql),getMovieQualitySettings()]);
  return{rows:rows.map(({total_count,...r})=>r),summary,settings,total,page,pages:Math.max(1,Math.ceil(total/pageSize)),pageSize};
}