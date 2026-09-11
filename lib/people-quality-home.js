import 'server-only';
import {db} from './db';
import {getPeopleQualitySummary} from './people-quality';

export async function getPeopleQualityHomeSummary(){
  const sql=db();
  const [fast]=await sql`SELECT
    count(*)::int total,
    count(*) FILTER(WHERE prs.filmography_refreshed_at IS NULL OR prs.filmography_refreshed_at<now()-interval '30 days')::int outside_fast_window,
    EXISTS(
      SELECT 1 FROM process_runs pr
      JOIN person_refresh_state pr_state ON pr_state.tmdb_person_id=pr.entity_id
      WHERE pr.process_code='PROC-PER-001' AND pr.entity_type='person' AND pr.technical_status='failed'
        AND (pr_state.filmography_refreshed_at IS NULL OR pr.requested_at>pr_state.filmography_refreshed_at)
    ) newer_failure,
    EXISTS(
      SELECT 1
      FROM movie_credits mc
      LEFT JOIN person_refresh_state prs2 ON prs2.tmdb_person_id=mc.tmdb_person_id
      WHERE prs2.tmdb_person_id IS NULL
      GROUP BY mc.tmdb_person_id
      HAVING count(DISTINCT mc.imdb_id) FILTER(WHERE mc.credit_type='cast')>5
        OR count(DISTINCT mc.imdb_id) FILTER(WHERE mc.credit_type='crew' AND lower(COALESCE(mc.job,''))='director')>5
    ) relevant_without_state
    FROM person_refresh_state prs`;

  const total=Number(fast?.total||0);
  const canProveHealthy=total>0
    && Number(fast?.outside_fast_window||0)===0
    && !fast?.newer_failure
    && !fast?.relevant_without_state;

  if(canProveHealthy)return{total,ok:total,never:0,stale:0,error:0,pending:0,fastPath:true};
  return{...(await getPeopleQualitySummary()),fastPath:false};
}
