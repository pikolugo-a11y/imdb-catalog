import 'server-only';
import {db} from './db';

export async function getPeopleDashboard(filters={}){
  const sql=db();
  const q=String(filters.q||'').trim();
  const role=String(filters.role||'acting');
  const sort=String(filters.sort||'titles');
  const page=Math.max(1,Number(filters.page)||1);
  const pageSize=50;
  const offset=(page-1)*pageSize;

  // Personas is a read surface: never run schema DDL here. The dashboard derives
  // collection metrics only from movie_credits + catalog_read_model, then enriches
  // the already-paged 50 people with optional external-filmography metadata.
  const rows=await sql`
    WITH base AS (
      SELECT
        p.tmdb_person_id,p.name,p.profile_path,p.known_for_department,p.birthday,p.deathday,p.place_of_birth,p.popularity,
        prs.filmography_refreshed_at,prs.filmography_count,
        count(DISTINCT mc.imdb_id) FILTER(WHERE mc.credit_type='cast')::int catalog_movies,
        count(DISTINCT mc.imdb_id) FILTER(WHERE mc.credit_type='crew' AND lower(COALESCE(mc.job,''))='director')::int directed_movies,
        count(DISTINCT mc.imdb_id) FILTER(WHERE mc.credit_type='cast' AND c.effective_status='in_plex')::int plex_movies,
        round(avg(c.final_rating) FILTER(WHERE mc.credit_type='cast' AND c.final_rating IS NOT NULL)::numeric,2) avg_score,
        count(c.final_rating) FILTER(WHERE mc.credit_type='cast' AND c.final_rating IS NOT NULL)::int scored
      FROM people p
      JOIN movie_credits mc ON mc.tmdb_person_id=p.tmdb_person_id
      JOIN catalog_read_model c ON c.imdb_id=mc.imdb_id
      LEFT JOIN person_refresh_state prs ON prs.tmdb_person_id=p.tmdb_person_id
      WHERE (${q}='' OR lower(p.name) LIKE lower(${'%'+q+'%'}))
      GROUP BY p.tmdb_person_id,p.name,p.profile_path,p.known_for_department,p.birthday,p.deathday,p.place_of_birth,p.popularity,prs.filmography_refreshed_at,prs.filmography_count
    ), eligible AS (
      SELECT b.*,count(*) OVER()::int total_count
      FROM base b
      WHERE ((${role}='acting' AND b.catalog_movies>5) OR (${role}='directing' AND b.directed_movies>5))
    ), paged AS (
      SELECT * FROM eligible
      ORDER BY
        CASE WHEN ${sort}='score' THEN avg_score END DESC NULLS LAST,
        CASE WHEN ${sort}='plex' THEN plex_movies END DESC NULLS LAST,
        CASE WHEN ${sort}='coverage' THEN plex_movies::numeric/NULLIF(catalog_movies,0) END DESC NULLS LAST,
        CASE WHEN ${role}='directing' THEN directed_movies ELSE catalog_movies END DESC,
        name
      LIMIT ${pageSize} OFFSET ${offset}
    ), extras AS (
      SELECT f.tmdb_person_id,
        count(DISTINCT f.tmdb_movie_id) FILTER(WHERE f.credit_type='cast' AND f.is_pikofilm_relevant IS FALSE AND m.imdb_id IS NULL)::int other_credits
      FROM person_filmography f
      LEFT JOIN movies m ON m.imdb_id=f.imdb_id
      WHERE f.tmdb_person_id=ANY(COALESCE((SELECT array_agg(tmdb_person_id) FROM paged),ARRAY[]::text[]))
      GROUP BY f.tmdb_person_id
    )
    SELECT p.*,COALESCE(e.other_credits,0)::int other_credits
    FROM paged p
    LEFT JOIN extras e USING(tmdb_person_id)
    ORDER BY
      CASE WHEN ${sort}='score' THEN p.avg_score END DESC NULLS LAST,
      CASE WHEN ${sort}='plex' THEN p.plex_movies END DESC NULLS LAST,
      CASE WHEN ${sort}='coverage' THEN p.plex_movies::numeric/NULLIF(p.catalog_movies,0) END DESC NULLS LAST,
      CASE WHEN ${role}='directing' THEN p.directed_movies ELSE p.catalog_movies END DESC,
      p.name`;

  let total=Number(rows[0]?.total_count||0);
  // If somebody lands on an out-of-range page, recover the real total without
  // re-running the expensive dashboard aggregation.
  if(rows.length===0&&page>1){
    const [count]=await sql`
      WITH b AS (
        SELECT p.tmdb_person_id,
          count(DISTINCT mc.imdb_id) FILTER(WHERE mc.credit_type='cast')::int a,
          count(DISTINCT mc.imdb_id) FILTER(WHERE mc.credit_type='crew' AND lower(COALESCE(mc.job,''))='director')::int d
        FROM people p
        JOIN movie_credits mc ON mc.tmdb_person_id=p.tmdb_person_id
        WHERE (${q}='' OR lower(p.name) LIKE lower(${'%'+q+'%'}))
        GROUP BY p.tmdb_person_id
      )
      SELECT count(*)::int total FROM b
      WHERE ((${role}='acting' AND a>5) OR (${role}='directing' AND d>5))`;
    total=Number(count?.total||0);
  }

  return{rows,total,page,pages:Math.max(1,Math.ceil(total/pageSize)),role};
}
