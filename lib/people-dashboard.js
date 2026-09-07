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

  // Ranking stays bounded on already-persisted PikoFilm data: no external refresh is
  // required. Visible refreshed people are then hydrated from person_filmography so
  // their displayed metrics remain identical to Persona detail.
  const rows=await sql`
    WITH base AS (
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
        round((avg(c.final_rating) FILTER(WHERE c.final_rating IS NOT NULL AND (
          (${role}='acting' AND mc.credit_type='cast') OR
          (${role}='directing' AND mc.credit_type='crew' AND lower(COALESCE(mc.job,''))='director')
        )))::numeric,2) legacy_avg_score,
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
    ), eligible AS (
      SELECT b.*,
        CASE WHEN b.legacy_scored>0
          THEN COALESCE(b.legacy_avg_score,0)*(b.legacy_scored::numeric/(b.legacy_scored+8))
          ELSE 0 END AS trusted_score,
        (
          ln(1+GREATEST(b.legacy_plex_movies,0))*28 +
          ln(1+GREATEST(b.legacy_role_movies,0))*10 +
          (CASE WHEN b.legacy_scored>0 THEN COALESCE(b.legacy_avg_score,0)*(b.legacy_scored::numeric/(b.legacy_scored+8)) ELSE 0 END)*8 +
          ln(1+GREATEST(COALESCE(b.popularity,0),0))*1.5
        ) AS relevance_score,
        count(*) OVER()::int total_count
      FROM base b WHERE b.legacy_role_movies>5
    ), paged AS (
      SELECT * FROM eligible
      ORDER BY
        CASE WHEN ${sort}='relevance' THEN relevance_score END DESC NULLS LAST,
        CASE WHEN ${sort}='score' THEN trusted_score END DESC NULLS LAST,
        CASE WHEN ${sort}='score' THEN legacy_scored END DESC NULLS LAST,
        CASE WHEN ${sort}='titles' THEN legacy_role_movies END DESC NULLS LAST,
        CASE WHEN ${sort}='plex' THEN legacy_plex_movies END DESC NULLS LAST,
        relevance_score DESC NULLS LAST,legacy_role_movies DESC,name
      LIMIT ${pageSize} OFFSET ${offset}
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
        round((avg(c.final_rating) FILTER(WHERE
          (m.imdb_id IS NOT NULL OR f.is_pikofilm_relevant IS NOT FALSE) AND c.final_rating IS NOT NULL AND
          ((${role}='acting' AND f.credit_type='cast') OR (${role}='directing' AND f.credit_type='crew' AND lower(COALESCE(f.job,''))='director'))
        )))::numeric,2) avg_score,
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
      WHERE f.tmdb_person_id=ANY(COALESCE((SELECT array_agg(tmdb_person_id) FROM paged),ARRAY[]::text[]))
      GROUP BY f.tmdb_person_id
    )
    SELECT p.tmdb_person_id,p.name,p.profile_path,p.known_for_department,p.birthday,p.deathday,p.place_of_birth,p.popularity,
      p.filmography_refreshed_at,p.filmography_count,p.relevance_score,p.trusted_score,p.total_count,
      CASE WHEN p.filmography_refreshed_at IS NOT NULL THEN COALESCE(c.role_movies,0) ELSE p.legacy_role_movies END::int role_movies,
      CASE WHEN p.filmography_refreshed_at IS NOT NULL THEN COALESCE(c.plex_movies,0) ELSE p.legacy_plex_movies END::int plex_movies,
      CASE WHEN p.filmography_refreshed_at IS NOT NULL THEN c.avg_score ELSE p.legacy_avg_score END avg_score,
      CASE WHEN p.filmography_refreshed_at IS NOT NULL THEN COALESCE(c.scored,0) ELSE p.legacy_scored END::int scored,
      CASE WHEN p.filmography_refreshed_at IS NOT NULL THEN COALESCE(c.outside_relevant,0) ELSE NULL END::int outside_relevant,
      CASE WHEN p.filmography_refreshed_at IS NOT NULL THEN COALESCE(c.other_credits,0) ELSE NULL END::int other_credits
    FROM paged p LEFT JOIN canonical c USING(tmdb_person_id)
    ORDER BY
      CASE WHEN ${sort}='relevance' THEN p.relevance_score END DESC NULLS LAST,
      CASE WHEN ${sort}='score' THEN p.trusted_score END DESC NULLS LAST,
      CASE WHEN ${sort}='score' THEN p.legacy_scored END DESC NULLS LAST,
      CASE WHEN ${sort}='titles' THEN p.legacy_role_movies END DESC NULLS LAST,
      CASE WHEN ${sort}='plex' THEN p.legacy_plex_movies END DESC NULLS LAST,
      p.relevance_score DESC NULLS LAST,p.legacy_role_movies DESC,p.name`;

  let total=Number(rows[0]?.total_count||0);
  if(rows.length===0&&page>1){
    const [count]=await sql`
      WITH b AS (
        SELECT p.tmdb_person_id,count(DISTINCT mc.imdb_id) FILTER(WHERE
          (${role}='acting' AND mc.credit_type='cast') OR
          (${role}='directing' AND mc.credit_type='crew' AND lower(COALESCE(mc.job,''))='director')
        )::int role_movies
        FROM people p JOIN movie_credits mc ON mc.tmdb_person_id=p.tmdb_person_id
        WHERE (${q}='' OR lower(p.name) LIKE lower(${'%'+q+'%'})) GROUP BY p.tmdb_person_id
      ) SELECT count(*)::int total FROM b WHERE role_movies>5`;
    total=Number(count?.total||0);
  }

  return{rows,total,page,pages:Math.max(1,Math.ceil(total/pageSize)),role,sort,pageSize};
}
