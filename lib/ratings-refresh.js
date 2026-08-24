import 'server-only';
import { db } from './db';
import { audit } from './runlog';
import { fetchMDBListRatings } from './ratings-provider-mdblist';
import { getTitleRatings, upsertTitleRating } from './title-ratings';

async function getMediaType(imdbId) {
  const sql = db();
  const rows = await sql`SELECT type FROM movies WHERE imdb_id=${imdbId} LIMIT 1`;
  if (!rows.length) throw new Error(`Título no encontrado: ${imdbId}`);
  return rows[0].type || 'movie';
}

/**
 * Motor único de Ratings. Individual y worker masivo deben usar esta función.
 * Solo obtiene/persiste ratings: PikoScore se calcula en otra fase, sin red.
 */
export async function refreshRatingsForTitle(imdbId, { signal } = {}) {
  if (!/^tt\d+$/.test(String(imdbId || ''))) throw new Error('IMDb ID inválido');
  const mediaType = await getMediaType(imdbId);
  await audit('ratings', 'title', imdbId, 'ratings_refresh_started', { provider: 'mdblist' });
  const started = Date.now();
  try {
    const fetched = await fetchMDBListRatings({ imdbId, mediaType, signal });
    let saved = 0;
    for (const rating of fetched.ratings) {
      await upsertTitleRating({ imdbId, ...rating });
      saved += 1;
    }
    const ratings = await getTitleRatings(imdbId);
    await audit('ratings', 'title', imdbId, 'ratings_refresh_completed', {
      provider: 'mdblist', received: fetched.ratings.length, saved, duration_ms: Date.now() - started,
    });
    return { verified: saved > 0, provider: 'mdblist', received: fetched.ratings.length, saved, ratings };
  } catch (error) {
    await audit('ratings', 'title', imdbId, 'ratings_refresh_failed', {
      provider: 'mdblist', error: error?.message || String(error), status: error?.status || null, duration_ms: Date.now() - started,
    });
    throw error;
  }
}

export const refreshRatings = refreshRatingsForTitle;
