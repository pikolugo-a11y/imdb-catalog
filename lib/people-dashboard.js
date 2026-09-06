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

  // Personas is a read surface: never run schema DDL here. Ranking is derived
  // from already-persisted PikoFilm data. External filmography is only consulted
  // after pagination to keep this screen bounded to its 50 visible people.
  const rows=await sql`
    WITH base AS (
      SELECT
        p.tmdb_person_id,p.name,p.profile_path,p.known_for_department,p.birthday,p.deathday,p.place_of_birth,p.popularity,
        prs.filmography_refreshed_at,prs.filmography_count,
        count(DISTINCT mc.imdb_id) FILTER(WHERE
          (${role}='acting' AND mc.credit_type='cast') OR
          (${role}='directing' AND mc.credit_type='crew' AND lower(COALESCE(mc.job,''))='director')
        )::int role_movies,
        count(DISTINCT mc.imdb_id) FILTER(WHERE c.effective_status='in_plex' AND (
          (${role}='acting' AND mc.credit_type='cast') OR
          (${role}='directing' AND mc.credit_type='crew' AND lower(COALESCE(mc.job,''))='director')
        ))::int plex_movies,
        round(avg(c.final_rating) FILTER(WHERE c.final_rating IS NOT NULL AND (
          (${role}='acting' AND mc.credit_type='cast') OR
          (${role}='directing' AND mc.credit_type='crew' AND lower(COALESCE(mc.job,''))='director')
        ))::numeric,2) avg_score,
        count(c.final_rating) FILTER(WHERE c.final_rating IS NOT NULL AND (
          (${role}='acting' AND mc.credit_type='cast') OR
          (${role}='directing' AND mc.credit_type='crew' AND lower(COALESCE(mc.job,''))='director')
        ))::int scored
      FROM people p
      JOIN movie_credits mc ON mc.tmdb_person_id=p.tmdb_person_id
      JOIN catalog_read_model c ON c.imdb_id=mc.imdb_id
      LEFT JOIN person_refresh_state prs ON prs.tmdb_person_id=p.tmdb_person_id
      WHERE (${q}='' OR lower(p.name) LIKE lower(${'%'+q+'%'}))
      GROUP BY p.tmdb_person_id,p.name,p.profile_path,p.known_for_department,p.birthday,p.deathday,p.place_of_birth,p.popularity,prs.filmography_refreshed_at,prs.filmography_count
    ), eligible AS (
      SELECT b.*,
        (COALESCE(b.avg_score,0)*12 + ln(1+GREATEST(b.role_movies,0))*14 + ln(1+GREATEST(COALESCE(b.popularity,0),0))*5) AS relevance_score,
        count(*) OVER()::int total_count
      FROM base b
      WHERE b.role_movies>5
    ), paged AS (
      SELECT * FROM eligible
      ORDER BY
        CASE WHEN ${sort}='relevance' THEN relevance_score END DESC NULLS LAST,
        CASE WHEN ${sort}='score' THEN avg_score END DESC NULLS LAST,
        CASE WHEN ${sort}='titles' THEN role_movies END DESC NULLS LAST,
        CASE WHEN ${sort}='plex' THEN plex_movies END DESC NULLS LAST,
        relevance_score DESC NULLS LAST,role_movies DESC,name
      LIMIT ${pageSize} OFFSET ${offset}
    ), extras AS (
      SELECT f.tmdb_person_id,
        count(DISTINCT f.tmdb_movie_id) FILTER(WHERE
          (f.is_pikofilm_relevant IS TRUE OR m.imdb_id IS NOT NULL) AND m.imdb_id IS NULL AND
          ((${role}='acting' AND f.credit_type='cast') OR (${role}='directing' AND f.credit_type='crew' AND lower(COALESCE(f.job,''))='director'))
        )::int outside_relevant,
        count(DISTINCT f.tmdb_movie_id) FILTER(WHERE
          f.is_pikofilm_relevant IS FALSE AND m.imdb_id IS NULL AND
          ((${role}='acting' AND f.credit_type='cast') OR (${role}='directing' AND f.credit_type='crew' AND lower(COALESCE(f.job,''))='director'))
        )::int other_credits
      FROM person_filmography f
      LEFT JOIN movies m ON m.imdb_id=f.imdb_id
      WHERE f.tmdb_person_id=ANY(COALESCE((SELECT array_agg(tmdb_person_id) FROM paged),ARRAY[]::text[]))
      GROUP BY f.tmdb_person_id
    )
    SELECT p.*,COALESCE(e.outside_relevant,0)::int outside_relevant,COALESCE(e.other_credits,0)::int other_credits
    FROM paged p
    LEFT JOIN extras e USING(tmdb_person_id)
    ORDER BY
      CASE WHEN ${sort}='relevance' THEN p.relevance_score END DESC NULLS LAST,
      CASE WHEN ${sort}='score' THEN p.avg_score END DESC NULLS LAST,
      CASE WHEN ${sort}='titles' THEN p.role_movies END DESC NULLS LAST,
      CASE WHEN ${sort}='plex' THEN p.plex_movies END DESC NULLS LAST,
      p.relevance_score DESC NULLS LAST,p.role_movies DESC,p.name`;

  let total=Number(rows[0]?.total_count||0);
  if(rows.length===0&&page>1){
    const [count]=await sql`
      WITH b AS (
        SELECT p.tmdb_person_id,count(DISTINCT mc.imdb_id) FILTER(WHERE
          (${role}='acting' AND mc.credit_type='cast') OR
          (${role}='directing' AND mc.credit_type='crew' AND lower(COALESCE(mc.job,''))='director')
        )::int role_movies
        FROM people p
        JOIN movie_credits mc ON mc.tmdb_person_id=p.tmdb_person_id
        WHERE (${q}='' OR lower(p.name) LIKE lower(${'%'+q+'%'}))
        GROUP BY p.tmdb_person_id
      )
      SELECT count(*)::int total FROM b WHERE role_movies>5`;
    total=Number(count?.total||0);
  }

  return{rows,total,page,pages:Math.max(1,Math.ceil(total/pageSize)),role,sort,pageSize};
}
