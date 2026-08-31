import 'server-only';
import {db} from './db';
import {ensurePeopleSchema} from './people-v2';

export const PERSON_QUALITY_MAX_AGE_DAYS=30;

const normalizeStatus=value=>['pending','never','stale','error','ok','all'].includes(String(value))?String(value):'pending';

export async function getPeopleQualityOverview(filters={}){
  await ensurePeopleSchema();
  const sql=db();
  const status=normalizeStatus(filters.status);
  const q=String(filters.q||'').trim();
  const page=Math.max(1,Number(filters.page)||1);
  const pageSize=50;
  const offset=(page-1)*pageSize;

  const base=sql`WITH relevant AS (
    SELECT p.tmdb_person_id,p.name,p.profile_path,p.known_for_department,
      count(DISTINCT mc.imdb_id) FILTER(WHERE mc.credit_type='cast')::int acting_titles,
      count(DISTINCT mc.imdb_id) FILTER(WHERE mc.credit_type='crew' AND lower(COALESCE(mc.job,''))='director')::int directed_titles
    FROM people p
    JOIN movie_credits mc ON mc.tmdb_person_id=p.tmdb_person_id
    GROUP BY p.tmdb_person_id,p.name,p.profile_path,p.known_for_department
    HAVING count(DISTINCT mc.imdb_id) FILTER(WHERE mc.credit_type='cast')>5
       OR count(DISTINCT mc.imdb_id) FILTER(WHERE mc.credit_type='crew' AND lower(COALESCE(mc.job,''))='director')>5
  ), quality AS (
    SELECT r.*,prs.filmography_refreshed_at,prs.filmography_count,
      lr.technical_status last_run_status,lr.requested_at last_run_at,lr.run_id last_run_id,
      CASE
        WHEN lr.technical_status='failed' AND (prs.filmography_refreshed_at IS NULL OR lr.requested_at>prs.filmography_refreshed_at) THEN 'error'
        WHEN prs.filmography_refreshed_at IS NULL THEN 'never'
        WHEN prs.filmography_refreshed_at<now()-interval '30 days' THEN 'stale'
        ELSE 'ok'
      END quality_status
    FROM relevant r
    LEFT JOIN person_refresh_state prs USING(tmdb_person_id)
    LEFT JOIN LATERAL (
      SELECT run_id,technical_status,requested_at
      FROM process_runs
      WHERE process_code='PROC-PER-001' AND entity_type='person' AND entity_id=r.tmdb_person_id
      ORDER BY requested_at DESC LIMIT 1
    ) lr ON true
  )`;

  const [summary]=await sql`${base} SELECT
    count(*)::int total,
    count(*) FILTER(WHERE quality_status='ok')::int ok,
    count(*) FILTER(WHERE quality_status='never')::int never,
    count(*) FILTER(WHERE quality_status='stale')::int stale,
    count(*) FILTER(WHERE quality_status='error')::int error
    FROM quality`;

  const whereStatus=status==='all'?sql``:status==='pending'?sql`AND quality_status<>'ok'`:sql`AND quality_status=${status}`;
  const rows=await sql`${base} SELECT * FROM quality
    WHERE (${q}='' OR lower(name) LIKE lower(${'%'+q+'%'})) ${whereStatus}
    ORDER BY CASE quality_status WHEN 'error' THEN 1 WHEN 'never' THEN 2 WHEN 'stale' THEN 3 ELSE 4 END,
      filmography_refreshed_at ASC NULLS FIRST,name ASC
    LIMIT ${pageSize} OFFSET ${offset}`;
  const [filtered]=await sql`${base} SELECT count(*)::int total FROM quality
    WHERE (${q}='' OR lower(name) LIKE lower(${'%'+q+'%'})) ${whereStatus}`;

  const total=Number(summary?.total||0),ok=Number(summary?.ok||0),never=Number(summary?.never||0),stale=Number(summary?.stale||0),error=Number(summary?.error||0);
  return {summary:{total,ok,never,stale,error,pending:never+stale+error},rows,status,q,page,pages:Math.max(1,Math.ceil(Number(filtered?.total||0)/pageSize)),filteredTotal:Number(filtered?.total||0),maxAgeDays:PERSON_QUALITY_MAX_AGE_DAYS};
}

export async function getPeopleQualitySummary(){
  const result=await getPeopleQualityOverview({status:'all'});
  return result.summary;
}
