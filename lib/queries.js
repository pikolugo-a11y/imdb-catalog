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

export async function getCatalog(filters = {}) {
  const sql = db();
  const q = String(filters.q || '').trim().toLowerCase();
  const type = String(filters.type || '').trim();
  const status = String(filters.status || '').trim();
  const genre = String(filters.genre || '').trim();
  const year = Number.parseInt(filters.year, 10);
  const yearFilter = Number.isFinite(year) ? year : null;

  return sql`
    SELECT imdb_id, type, display_title, original_title, year, runtime, country,
           final_rating, imdb_rating, imdb_votes, fa_rating, fa_votes, tmdb_rating,
           genres, effective_status, plex_status, resolution, collection_name, poster_path
    FROM catalog_read_model
    WHERE (${q} = '' OR lower(display_title) LIKE ${'%' + q + '%'} OR lower(COALESCE(original_title,'')) LIKE ${'%' + q + '%'})
      AND (${type} = '' OR type = ${type})
      AND (${yearFilter}::int IS NULL OR year = ${yearFilter})
      AND (${genre} = '' OR ${genre} = ANY(genres))
      AND (
        ${status} = ''
        OR (${status} = 'in_plex' AND effective_status = 'in_plex')
        OR (${status} = 'acquiring' AND effective_status = 'acquiring')
        OR (${status} = 'missing' AND (effective_status NOT IN ('in_plex','acquiring') OR effective_status IS NULL))
      )
    ORDER BY final_rating DESC NULLS LAST, imdb_votes DESC NULLS LAST
    LIMIT 150
  `;
}

export async function getCatalogFilters() {
  const sql = db();
  const [genres, years] = await Promise.all([
    sql`SELECT DISTINCT unnest(genres) AS value FROM catalog_read_model WHERE genres IS NOT NULL ORDER BY value`,
    sql`SELECT DISTINCT year AS value FROM catalog_read_model WHERE year IS NOT NULL ORDER BY year DESC`
  ]);
  return { genres: genres.map(x => x.value), years: years.map(x => x.value) };
}

export async function getCatalogItem(imdbId) {
  const sql = db();
  const [item] = await sql`
    SELECT c.*, m.overview, m.tagline, m.certification, m.original_language,
           m.release_date, m.budget, m.revenue, m.trailer_key, m.trailer_site
    FROM catalog_read_model c
    LEFT JOIN movie_metadata m ON m.imdb_id = c.imdb_id
    WHERE c.imdb_id = ${imdbId}
    LIMIT 1
  `;
  if (!item) return null;
  const credits = await sql`
    SELECT p.name, p.profile_path, c.credit_type, c.character_name, c.job, c.credit_order
    FROM movie_credits c
    JOIN people p ON p.tmdb_person_id = c.tmdb_person_id
    WHERE c.imdb_id = ${imdbId}
    ORDER BY CASE WHEN c.credit_type = 'cast' THEN 0 ELSE 1 END, c.credit_order NULLS LAST
    LIMIT 30
  `;
  return { ...item, credits };
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

export async function getSeriesDetail(showRatingKey) {
  const sql = db();
  const [series] = await sql`
    SELECT show_rating_key, tmdb_id, imdb_id, tvdb_id, title, original_title, year,
           official_seasons, official_episodes, avg_runtime_minutes, reference_source, refreshed_at
    FROM series_reference
    WHERE show_rating_key = ${showRatingKey}
    LIMIT 1
  `;
  if (!series) return null;
  const episodes = await sql`
    SELECT d.season_number, d.episode_number, d.status, d.confidence, d.reason,
           d.covered_by_rating_key, d.expected_name, d.expected_runtime_minutes,
           d.actual_duration_minutes, d.search_hint, d.diagnosed_at,
           e.air_date, e.overview
    FROM series_diagnostics d
    LEFT JOIN series_reference_episodes e
      ON e.show_rating_key = d.show_rating_key
     AND e.season_number = d.season_number
     AND e.episode_number = d.episode_number
    WHERE d.show_rating_key = ${showRatingKey}
    ORDER BY d.season_number, d.episode_number
  `;
  return { ...series, episodes };
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
