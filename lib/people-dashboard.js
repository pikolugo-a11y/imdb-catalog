import 'server-only';
import {db} from './db';

const ALLOWED_ROLES=new Set(['acting','directing']);
const ALLOWED_SORTS=new Set(['relevance','score','titles','plex']);

export async function getPeopleDashboard(filters={}){
  const sql=db();
  const q=String(filters.q||'').trim();
  const role=ALLOWED_ROLES.has(String(filters.role||''))?String(filters.role):'acting';
  const sort=ALLOWED_SORTS.has(String(filters.sort||''))?String(filters.sort):'relevance';
  const page=Math.max(1,Number(filters.page)||1);
  const pageSize=50;
  const offset=(page-1)*pageSize;

  // Once a person has a refreshed filmography, Personas must use the exact same
  // canonical universe as the detail screen. Legacy movie_credits remains only
  // as a fallback for people whose external filmography has never been refreshed.
  const rows=await sql`
    WITH legacy AS (
      SELECT
        p.tmdb_person_id,p.name,p.profile_path,p.known_for_department,p.birthday,p.deathday,p.place_of_birth,p.popularity,
        prs.filmography_refreshed_at,prs.filmography_count,
        count(DISTINCT mc.imdb_id) FILTER(WHERE
          (${role}='acting' AND mc.credit_type='cast') OR
          (${role}='directing' AND mc.credit_type='crew' AND lower(COALESCE(mc.job,''))='director')
        )::int legacy_role_movies,
        count(DISTINCT mc.imdb_id) FILTER(WHERE c.effective_status='in_plex' AND (
          (${role}='acting' AND mc.credit_type='cast') OR
          (${role}='directing' AND mc.credit_type='crew' AND lower(COALESCE(mc.job,''))='director')
        ))::int legacy_plex_movies,
        round(avg(c.final_rating) FILTER(WHERE c.final_rating IS NOT NULL AND (
          (${role}='acting' AND mc.credit_type='cast') OR
          (${role}='directing' AND mc.credit_type='crew' AND lower(COALESCE(mc.job,''))='director')
        ))::numeric,2) legacy_avg_score,
        count(c.final_rating) FILTER(WHERE c.final_rating IS NOT NULL AND (
          (${role}='acting' AND mc.credit_type='cast') OR
          (${role}='directing' AND mc.credit_type='crew' AND lower(COALESCE(mc.job,''))='director')
        ))::int legacy_scored
      FROM people p
      JOIN movie_credits mc ON mc.tmdb_person_id=p.tmdb_person_id
      JOIN catalog_read_model c ON c.imdb_id=mc.imdb_id
      LEFT JOIN person_refresh_state prs ON prs.tmdb_person_id=p.tmdb_person_id
      WHERE (${q}='' OR lower(p.name) LIKE lower(${'%'+q+'%'}))
      GROUP BY p.tmdb_person_id,p.name,p.profile_path,p.known_for_department,p.birthday,p.deathday,p.place_of_birth,p.popularity,prs.filmography_refreshed_at,prs.filmography_count
    ), canonical AS (
      SELECT f.tmdb_person_id,
        count(DISTINCT f.tmdb_movie_id) FILTER(WHERE
          (m.imdb_id IS NOT NULL OR f.is_pikofilm_relevant IS NOT FALSE) AND
          ((${role}='acting' AND f.credit_type='cast') OR (${role}='directing' AND f.credit_type='crew' AND lower(COALESCE(f.job,''))='director'))
        )::int role_movies,
        count(DISTINCT f.tmdb_movie_id) FILTER(WHERE
          (m.imdb_id IS NOT NULL OR f.is_pikofilm_relevant IS NOT FALSE) AND c.effective_status='in_plex' AND
          ((${role}='acting' AND f.credit_type='cast') OR (${role}='directing' AND f.credit_type='crew' AND lower(COALESCE(f.job,''))='director'))
        )::int plex_movies,
        round(avg(c.final_rating) FILTER(WHERE
          (m.imdb_id IS NOT NULL OR f.is_pikofilm_relevant IS NOT FALSE) AND c.final_rating IS NOT NULL AND
          ((${role}='acting' AND f.credit_type='cast') OR (${role}='directing' AND f.credit_type='crew' AND lower(COALESCE(f.job,''))='director'))
        ))::numeric,2) avg_score,
        count(c.final_rating) FILTER(WHERE
          (m.imdb_id IS NOT NULL OR f.is_pikofilm_relevant IS NOT FALSE) AND c.final_rating IS NOT NULL AND
          ((${role}='acting' AND f.credit_type='cast') OR (${role}='directing' AND f.credit_type='crew' AND lower(COALESCE(f.job,''))='director'))
        )::int scored,
        count(DISTINCT f.tmdb_movie_id) FILTER(WHERE
          (m.imdb_id IS NOT NULL OR f.is_pikofilm_relevant IS NOT FALSE) AND m.imdb_id IS NULL AND
          ((${role}='acting' AND f.credit_type='cast') OR (${role}='directing' AND f.credit_type='crew' AND lower(COALESCE(f.job,''))='director'))
        )::int outside_relevant,
        count(DISTINCT f.tmdb_movie_id) FILTER(WHERE
          f.is_pikofilm_relevant IS FALSE AND m.imdb_id IS NULL AND
          ((${role}='acting' AND f.credit_type='cast') OR (${role}='directing' AND f.credit_type='crew' AND lower(COALESCE(f.job,''))='director'))
        )::int other_credits
      FROM person_filmography f
      LEFT JOIN movies m ON m.imdb_id=f.imdb_id
      LEFT JOIN catalog_read_model c ON c.imdb_id=f.imdb_id
      GROUP BY f.tmdb_person_id
    ), base AS (
      SELECT l.tmdb_person_id,l.name,l.profile_path,l.known_for_department,l.birthday,l.deathday,l.place_of_birth,l.popularity,
        l.filmography_refreshed_at,l.filmography_count,
        CASE WHEN l.filmography_refreshed_at IS NOT NULL THEN COALESCE(c.role_movies,0) ELSE l.legacy_role_movies END::int role_movies,
        CASE WHEN l.filmography_refreshed_at IS NOT NULL THEN COALESCE(c.plex_movies,0) ELSE l.legacy_plex_movies END::int plex_movies,
        CASE WHEN l.filmography_refreshed_at IS NOT NULL THEN c.avg_score ELSE l.legacy_avg_score END avg_score,
        CASE WHEN l.filmography_refreshed_at IS NOT NULL THEN COALESCE(c.scored,0) ELSE l.legacy_scored END::int scored,
        CASE WHEN l.filmography_refreshed_at IS NOT NULL THEN COALESCE(c.outside_relevant,0) ELSE NULL END::int outside_relevant,
        CASE WHEN l.filmography_refreshed_at IS NOT NULL THEN COALESCE(c.other_credits,0) ELSE NULL END::int other_credits
      FROM legacy l LEFT JOIN canonical c USING(tmdb_person_id)
    ), eligible AS (
      SELECT b.*,
        (COALESCE(b.avg_score,0)*12 + ln(1+GREATEST(b.role_movies,0))*14 + ln(1+GREATEST(COALESCE(b.popularity,0),0))*5) AS relevance_score,
        count(*) OVER()::int total_count
      FROM base b WHERE b.role_movies>5
    )
    SELECT * FROM eligible
    ORDER BY
      CASE WHEN ${sort}='relevance' THEN relevance_score END DESC NULLS LAST,
      CASE WHEN ${sort}='score' THEN avg_score END DESC NULLS LAST,
      CASE WHEN ${sort}='titles' THEN role_movies END DESC NULLS LAST,
      CASE WHEN ${sort}='plex' THEN plex_movies END DESC NULLS LAST,
      relevance_score DESC NULLS LAST,role_movies DESC,name
    LIMIT ${pageSize} OFFSET ${offset}`;

  let total=Number(rows[0]?.total_count||0);
  if(rows.length===0&&page>1){
    const [count]=await sql`
      WITH legacy AS (
        SELECT p.tmdb_person_id,prs.filmography_refreshed_at,
          count(DISTINCT mc.imdb_id) FILTER(WHERE
            (${role}='acting' AND mc.credit_type='cast') OR
            (${role}='directing' AND mc.credit_type='crew' AND lower(COALESCE(mc.job,''))='director')
          )::int legacy_role_movies
        FROM people p JOIN movie_credits mc ON mc.tmdb_person_id=p.tmdb_person_id
        LEFT JOIN person_refresh_state prs ON prs.tmdb_person_id=p.tmdb_person_id
        WHERE (${q}='' OR lower(p.name) LIKE lower(${'%'+q+'%'}))
        GROUP BY p.tmdb_person_id,prs.filmography_refreshed_at
      ), canonical AS (
        SELECT f.tmdb_person_id,count(DISTINCT f.tmdb_movie_id) FILTER(WHERE
          (m.imdb_id IS NOT NULL OR f.is_pikofilm_relevant IS NOT FALSE) AND
          ((${role}='acting' AND f.credit_type='cast') OR (${role}='directing' AND f.credit_type='crew' AND lower(COALESCE(f.job,''))='director'))
        )::int role_movies
        FROM person_filmography f LEFT JOIN movies m ON m.imdb_id=f.imdb_id GROUP BY f.tmdb_person_id
      )
      SELECT count(*)::int total FROM legacy l LEFT JOIN canonical c USING(tmdb_person_id)
      WHERE (CASE WHEN l.filmography_refreshed_at IS NOT NULL THEN COALESCE(c.role_movies,0) ELSE l.legacy_role_movies END)>5`;
    total=Number(count?.total||0);
  }

  return{rows,total,page,pages:Math.max(1,Math.ceil(total/pageSize)),role,sort,pageSize};
}
