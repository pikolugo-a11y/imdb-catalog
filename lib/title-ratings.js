import 'server-only';
import { db } from './db';

export const RATING_SOURCES = Object.freeze({
  IMDB: 'imdb',
  TMDB: 'tmdb',
  TRAKT: 'trakt',
  LETTERBOXD: 'letterboxd',
  RT_CRITICS: 'rt_critics',
  RT_AUDIENCE: 'rt_audience',
  METACRITIC: 'metacritic',
  METACRITIC_USER: 'metacritic_user',
  ROGER_EBERT: 'roger_ebert',
});

export function normalizeRating(rating, scale = 10) {
  const value = Number(rating);
  const max = Number(scale);
  if (!Number.isFinite(value) || !Number.isFinite(max) || max <= 0) return null;
  return Math.round((value / max) * 10 * 1000) / 1000;
}

export async function getTitleRatings(imdbId) {
  const sql = db();
  return sql`
    SELECT imdb_id, source, rating, scale, normalized_rating, votes,
           rating_type, provider, observed_at, fetched_at, expires_at,
           status, error_code, error_message
    FROM title_ratings
    WHERE imdb_id = ${imdbId}
    ORDER BY source
  `;
}

export async function upsertTitleRating({
  imdbId,
  source,
  rating = null,
  scale = 10,
  votes = null,
  ratingType = 'audience',
  provider,
  observedAt = null,
  expiresAt = null,
  status = 'available',
  errorCode = null,
  errorMessage = null,
  rawPayload = null,
}) {
  const sql = db();
  const normalized = rating == null ? null : normalizeRating(rating, scale);
  const safeVotes = votes == null || votes === '' ? null : Number(votes);
  return sql`
    INSERT INTO title_ratings (
      imdb_id, source, rating, scale, normalized_rating, votes,
      rating_type, provider, observed_at, fetched_at, expires_at,
      status, error_code, error_message, raw_payload
    ) VALUES (
      ${imdbId}, ${source}, ${rating}, ${scale}, ${normalized}, ${Number.isFinite(safeVotes) ? safeVotes : null},
      ${ratingType}, ${provider}, ${observedAt}, now(), ${expiresAt},
      ${status}, ${errorCode}, ${errorMessage}, ${rawPayload ? JSON.stringify(rawPayload) : null}::jsonb
    )
    ON CONFLICT (imdb_id, source) DO UPDATE SET
      rating = EXCLUDED.rating,
      scale = EXCLUDED.scale,
      normalized_rating = EXCLUDED.normalized_rating,
      votes = EXCLUDED.votes,
      rating_type = EXCLUDED.rating_type,
      provider = EXCLUDED.provider,
      observed_at = EXCLUDED.observed_at,
      fetched_at = now(),
      expires_at = EXCLUDED.expires_at,
      status = EXCLUDED.status,
      error_code = EXCLUDED.error_code,
      error_message = EXCLUDED.error_message,
      raw_payload = EXCLUDED.raw_payload
    RETURNING *
  `;
}

export async function markTitleRatingUnavailable({ imdbId, source, provider, errorCode = null, errorMessage = null }) {
  return upsertTitleRating({
    imdbId,
    source,
    provider,
    rating: null,
    votes: null,
    status: 'unavailable',
    errorCode,
    errorMessage,
  });
}
