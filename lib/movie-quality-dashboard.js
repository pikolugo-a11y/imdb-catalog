import 'server-only';
import {db} from './db';
import {getMovieQualitySettings} from './movie-quality-settings';

export async function getMovieQualityDashboard(filters={}){
  const sql=db(),q=String(filters.q||'').trim().toLowerCase(),type=String(filters.type||''),status=filters.status===undefined?'pending':String(filters.status||''),risk=String(filters.risk||''),page=Math.max(1,Number(filters.page)||1),pageSize=10,offset=(page-1)*pageSize;
  const rows=await sql`SELECT f.id,f.finding_type,f.severity,f.risk_score,f.status,f.details,f.first_seen_at,f.last_seen_at,f.imdb_id,p.rating_key,p.plex_title,p.plex_year,pm.resolution,pm.bitrate,pm.width,pm.height,pm.video_codec,pm.audio_codec,pm.audio_channels,pf.file_path,pf.file_size_bytes,c.poster_path,pq.score pikoquality_score,pq.band pikoquality_band,count(*) OVER()::int total_count FROM movie_quality_findings f JOIN plex_items p ON p.rating_key=f.rating_key LEFT JOIN LATERAL(SELECT * FROM plex_media z WHERE z.rating_key=p.rating_key ORDER BY media_index LIMIT 1)pm ON true LEFT JOIN LATERAL(SELECT * FROM plex_files z WHERE z.rating_key=p.rating_key ORDER BY media_index,part_index LIMIT 1)pf ON true LEFT JOIN catalog_read_model c ON c.imdb_id=f.imdb_id LEFT JOIN piko_quality pq ON pq.rating_key=f.rating_key WHERE (${status}='' OR f.status=${status}) AND (${type}='' OR f.finding_type=${type}) AND (${risk}='' OR (${risk}='high' AND f.risk_score>=65)) AND (${q}='' OR lower(COALESCE(p.plex_title,'')) LIKE ${'%'+q+'%'}) ORDER BY f.risk_score DESC,f.last_seen_at DESC LIMIT ${pageSize} OFFSET ${offset}`;
  const total=rows[0]?.total_count||0;
  const [summary]=await sql`SELECT count(*) FILTER(WHERE status='pending')::int pending,count(DISTINCT rating_key) FILTER(WHERE status='pending')::int affected,count(*) FILTER(WHERE status='exception')::int exceptions,count(*) FILTER(WHERE status='waiting_sync')::int waiting_sync,count(*) FILTER(WHERE status='resolved')::int resolved,count(*) FILTER(WHERE status='pending' AND risk_score>=65)::int priority,max(last_seen_at) last_analysis FROM movie_quality_findings`;
  const types=await sql`SELECT finding_type,count(*)::int total,count(DISTINCT rating_key)::int affected FROM movie_quality_findings WHERE status='pending' GROUP BY finding_type ORDER BY finding_type`;
  const [lastRun]=await sql`SELECT id,status,started_at,finished_at,processed_count,updated_count,error_count,summary FROM pipeline_runs WHERE job_type='movie_quality_analysis' ORDER BY started_at DESC LIMIT 1`;
  const settings=await getMovieQualitySettings();
  return{rows:rows.map(({total_count,...r})=>r),summary:{...(summary||{}),types},lastRun:lastRun||null,settings,total,page,pages:Math.max(1,Math.ceil(total/pageSize)),pageSize};
}
