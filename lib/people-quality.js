import 'server-only';
import {db} from './db';

export const PERSON_QUALITY_MAX_AGE_DAYS=1095;
const normalizeStatus=value=>['pending','never','stale','error','ok','all'].includes(String(value))?String(value):'pending';

export async function getPeopleQualityOverview(filters={}){
  const sql=db();
  const status=normalizeStatus(filters.status);
  const q=String(filters.q||'').trim();
  const page=Math.max(1,Number(filters.page)||1),pageSize=50,offset=(page-1)*pageSize;

  const [result]=await sql`
    WITH latest_runs AS MATERIALIZED (
      SELECT DISTINCT ON (entity_id) entity_id,run_id,technical_status,requested_at
      FROM process_runs
      WHERE process_code='PROC-PER-001' AND entity_type='person'
      ORDER BY entity_id,requested_at DESC
    ), relevant AS MATERIALIZED (
      SELECT p.tmdb_person_id,p.name,p.profile_path,p.known_for_department,p.deathday,
        count(DISTINCT mc.imdb_id) FILTER(WHERE mc.credit_type='cast')::int acting_titles,
        count(DISTINCT mc.imdb_id) FILTER(WHERE mc.credit_type='crew' AND lower(COALESCE(mc.job,''))='director')::int directed_titles
      FROM people p JOIN movie_credits mc ON mc.tmdb_person_id=p.tmdb_person_id
      GROUP BY p.tmdb_person_id,p.name,p.profile_path,p.known_for_department,p.deathday
      HAVING count(DISTINCT mc.imdb_id) FILTER(WHERE mc.credit_type='cast')>5
        OR count(DISTINCT mc.imdb_id) FILTER(WHERE mc.credit_type='crew' AND lower(COALESCE(mc.job,''))='director')>5
    ), activity AS MATERIALIZED (
      SELECT r.*,max(pf.release_date) last_work_date
      FROM relevant r LEFT JOIN person_filmography pf USING(tmdb_person_id)
      GROUP BY r.tmdb_person_id,r.name,r.profile_path,r.known_for_department,r.deathday,r.acting_titles,r.directed_titles
    ), freshness AS MATERIALIZED (
      SELECT a.*,CASE
        WHEN a.deathday IS NOT NULL THEN 1095
        WHEN a.last_work_date>=CURRENT_DATE-INTERVAL '1 year' THEN 30
        WHEN a.last_work_date>=CURRENT_DATE-INTERVAL '3 years' THEN 90
        WHEN a.last_work_date>=CURRENT_DATE-INTERVAL '10 years' THEN 365
        WHEN a.last_work_date IS NULL THEN 365 ELSE 1095 END refresh_days
      FROM activity a
    ), quality AS MATERIALIZED (
      SELECT r.*,prs.filmography_refreshed_at,prs.filmography_count,
        lr.technical_status last_run_status,lr.requested_at last_run_at,lr.run_id last_run_id,
        CASE WHEN lr.technical_status='failed' AND (prs.filmography_refreshed_at IS NULL OR lr.requested_at>prs.filmography_refreshed_at) THEN 'error'
          WHEN prs.filmography_refreshed_at IS NULL THEN 'never'
          WHEN prs.filmography_refreshed_at<now()-(r.refresh_days||' days')::interval THEN 'stale' ELSE 'ok' END quality_status
      FROM freshness r
      LEFT JOIN person_refresh_state prs USING(tmdb_person_id)
      LEFT JOIN latest_runs lr ON lr.entity_id=r.tmdb_person_id
    ), filtered AS MATERIALIZED (
      SELECT * FROM quality
      WHERE (${q}='' OR lower(name) LIKE lower(${'%'+q+'%'}))
        AND (${status}='all' OR (${status}='pending' AND quality_status<>'ok') OR quality_status=${status})
    ), page_rows AS MATERIALIZED (
      SELECT * FROM filtered
      ORDER BY CASE quality_status WHEN 'error' THEN 1 WHEN 'never' THEN 2 WHEN 'stale' THEN 3 ELSE 4 END,
        filmography_refreshed_at ASC NULLS FIRST,name ASC
      LIMIT ${pageSize} OFFSET ${offset}
    )
    SELECT
      (SELECT count(*)::int FROM quality) total,
      (SELECT count(*)::int FROM quality WHERE quality_status='ok') ok,
      (SELECT count(*)::int FROM quality WHERE quality_status='never') never,
      (SELECT count(*)::int FROM quality WHERE quality_status='stale') stale,
      (SELECT count(*)::int FROM quality WHERE quality_status='error') error,
      (SELECT count(*)::int FROM filtered) filtered_total,
      COALESCE((SELECT jsonb_agg(to_jsonb(pr) ORDER BY CASE pr.quality_status WHEN 'error' THEN 1 WHEN 'never' THEN 2 WHEN 'stale' THEN 3 ELSE 4 END,pr.filmography_refreshed_at ASC NULLS FIRST,pr.name ASC) FROM page_rows pr),'[]'::jsonb) rows
  `;

  const total=Number(result?.total||0),ok=Number(result?.ok||0),never=Number(result?.never||0),stale=Number(result?.stale||0),error=Number(result?.error||0),filteredTotal=Number(result?.filtered_total||0);
  const rows=Array.isArray(result?.rows)?result.rows:[];
  return {summary:{total,ok,never,stale,error,pending:never+stale+error},rows,status,q,page,pages:Math.max(1,Math.ceil(filteredTotal/pageSize)),filteredTotal,maxAgeDays:PERSON_QUALITY_MAX_AGE_DAYS,adaptiveFreshness:true};
}

export async function getPeopleQualitySummary(){
  const sql=db();
  const [summary]=await sql`WITH relevant AS (
    SELECT p.tmdb_person_id,p.deathday
    FROM people p JOIN movie_credits mc ON mc.tmdb_person_id=p.tmdb_person_id
    GROUP BY p.tmdb_person_id,p.deathday
    HAVING count(DISTINCT mc.imdb_id) FILTER(WHERE mc.credit_type='cast')>5 OR count(DISTINCT mc.imdb_id) FILTER(WHERE mc.credit_type='crew' AND lower(COALESCE(mc.job,''))='director')>5
  ), activity AS (
    SELECT r.*,max(pf.release_date) last_work_date
    FROM relevant r LEFT JOIN person_filmography pf USING(tmdb_person_id)
    GROUP BY r.tmdb_person_id,r.deathday
  ), freshness AS (
    SELECT a.*,CASE
      WHEN a.deathday IS NOT NULL THEN 1095
      WHEN a.last_work_date>=CURRENT_DATE-INTERVAL '1 year' THEN 30
      WHEN a.last_work_date>=CURRENT_DATE-INTERVAL '3 years' THEN 90
      WHEN a.last_work_date>=CURRENT_DATE-INTERVAL '10 years' THEN 365
      WHEN a.last_work_date IS NULL THEN 365 ELSE 1095 END refresh_days
    FROM activity a
  ), quality AS (
    SELECT r.tmdb_person_id,CASE WHEN lr.technical_status='failed' AND (prs.filmography_refreshed_at IS NULL OR lr.requested_at>prs.filmography_refreshed_at) THEN 'error'
      WHEN prs.filmography_refreshed_at IS NULL THEN 'never'
      WHEN prs.filmography_refreshed_at<now()-(r.refresh_days||' days')::interval THEN 'stale' ELSE 'ok' END quality_status
    FROM freshness r LEFT JOIN person_refresh_state prs USING(tmdb_person_id)
    LEFT JOIN LATERAL (SELECT technical_status,requested_at FROM process_runs WHERE process_code='PROC-PER-001' AND entity_type='person' AND entity_id=r.tmdb_person_id ORDER BY requested_at DESC LIMIT 1) lr ON true
  ) SELECT count(*)::int total,count(*) FILTER(WHERE quality_status='ok')::int ok,count(*) FILTER(WHERE quality_status='never')::int never,count(*) FILTER(WHERE quality_status='stale')::int stale,count(*) FILTER(WHERE quality_status='error')::int error FROM quality`;
  const total=Number(summary?.total||0),ok=Number(summary?.ok||0),never=Number(summary?.never||0),stale=Number(summary?.stale||0),error=Number(summary?.error||0);
  return {total,ok,never,stale,error,pending:never+stale+error};
}
