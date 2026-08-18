import 'server-only';
import { db } from './db';

export async function getDashboard() {
  const sql = db();
  const [row] = await sql`
    SELECT
      (SELECT count(*)::int FROM catalog_read_model) AS catalog_total,
      (SELECT count(*)::int FROM catalog_read_model WHERE effective_status = 'in_plex') AS catalog_in_plex,
      (SELECT count(*)::int FROM catalog_read_model WHERE effective_status = 'acquiring') AS catalog_acquiring,
      (SELECT count(*)::int FROM catalog_read_model WHERE effective_status NOT IN ('in_plex','acquiring') OR effective_status IS NULL) AS catalog_missing,
      (SELECT count(*)::int FROM plex_review_tasks WHERE status = 'pending') AS movie_review_pending,
      (SELECT count(DISTINCT show_rating_key)::int FROM series_diagnostics WHERE status <> 'present') AS series_with_issues,
      (SELECT count(*)::int FROM series_diagnostics WHERE status = 'missing') AS missing_episodes,
      (SELECT count(*)::int FROM plex_not_in_catalog) AS plex_not_in_catalog
  `;
  return row;
}

export async function getCatalog(limit = 80) {
  const sql = db();
  return sql`
    SELECT imdb_id, type, display_title, original_title, year, runtime, country,
           final_rating, imdb_rating, imdb_votes, fa_rating, fa_votes, tmdb_rating,
           genres, effective_status, plex_status, resolution, collection_name, poster_path
    FROM catalog_read_model
    ORDER BY final_rating DESC NULLS LAST, imdb_votes DESC NULLS LAST
    LIMIT ${limit}
  `;
}

export async function getPlexSummary() {
  const sql = db();
  const [row] = await sql`
    SELECT
      (SELECT count(*)::int FROM plex_items WHERE active) AS active_items,
      (SELECT count(*)::int FROM plex_library WHERE in_plex) AS catalog_matches,
      (SELECT count(*)::int FROM plex_not_in_catalog) AS outside_catalog,
      (SELECT count(*)::int FROM plex_items WHERE active AND watched) AS watched_items
  `;
  return row;
}

export async function getPlexOutsideCatalog(limit = 80) {
  const sql = db();
  return sql`
    SELECT rating_key, plex_title, plex_year, added_at, imdb_id, catalog_state
    FROM plex_not_in_catalog
    ORDER BY added_at DESC NULLS LAST
    LIMIT ${limit}
  `;
}

export async function getMovieQuality(limit = 80) {
  const sql = db();
  return sql`
    SELECT t.id, t.rating_key, t.task_type, t.reasons, t.risk_score, t.status,
           p.plex_title, p.plex_year
    FROM plex_review_tasks t
    JOIN plex_items p ON p.rating_key = t.rating_key
    WHERE t.status = 'pending'
    ORDER BY t.risk_score DESC, t.created_at
    LIMIT ${limit}
  `;
}

export async function getSeriesQuality(limit = 100) {
  const sql = db();
  return sql`
    SELECT r.show_rating_key, r.title, r.year, r.official_seasons, r.official_episodes,
           count(*) FILTER (WHERE d.status = 'present')::int AS present,
           count(*) FILTER (WHERE d.status = 'missing')::int AS missing,
           count(*) FILTER (WHERE d.status = 'covered_combined')::int AS combined,
           count(*)::int AS diagnosed
    FROM series_reference r
    JOIN series_diagnostics d ON d.show_rating_key = r.show_rating_key
    GROUP BY r.show_rating_key, r.title, r.year, r.official_seasons, r.official_episodes
    HAVING count(*) FILTER (WHERE d.status <> 'present') > 0
    ORDER BY missing DESC, r.title
    LIMIT ${limit}
  `;
}

export async function getSagas(limit = 80) {
  const sql = db();
  return sql`
    SELECT collection_name,
           count(*)::int AS total_selected,
           count(*) FILTER (WHERE effective_status = 'in_plex')::int AS in_plex,
           count(*) FILTER (WHERE effective_status = 'acquiring')::int AS acquiring,
           count(*) FILTER (WHERE effective_status NOT IN ('in_plex','acquiring') OR effective_status IS NULL)::int AS missing
    FROM catalog_read_model
    WHERE collection_name IS NOT NULL
    GROUP BY collection_name
    HAVING count(*) >= 2
    ORDER BY total_selected DESC, collection_name
    LIMIT ${limit}
  `;
}
