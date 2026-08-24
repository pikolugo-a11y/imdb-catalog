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

async function persistMDBListExtras(imdbId, extras = {}) {
  if (!extras || !Object.keys(extras).length) return false;
  const sql = db();
  const patch = {
    mdblist_metadata: {
      ...extras,
      provider: 'mdblist',
      fetched_at: new Date().toISOString(),
    },
  };
  await sql`
    UPDATE movies
    SET source_status = COALESCE(source_status,'{}'::jsonb) || ${JSON.stringify(patch)}::jsonb,
        synced_at = now()
    WHERE imdb_id = ${imdbId}
  `;
  return true;
}

/**
 * Motor único de Ratings. Individual y worker masivo deben usar esta función.
 * Solo obtiene/persiste ratings y metadatos ligeros de la MISMA respuesta;
 * PikoScore se calcula en otra fase, sin red.
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
    const extrasSaved = await persistMDBListExtras(imdbId, fetched.extras);
    const ratings = await getTitleRatings(imdbId);
    await audit('ratings', 'title', imdbId, 'ratings_refresh_completed', {
      provider: 'mdblist',
      received: fetched.ratings.length,
      saved,
      extras_saved: extrasSaved,
      extras_keys: Object.keys(fetched.extras || {}),
      duration_ms: Date.now() - started,
    });
    return {
      verified: saved > 0,
      provider: 'mdblist',
      received: fetched.ratings.length,
      saved,
      ratings,
      extras: fetched.extras || {},
      extrasSaved,
    };
  } catch (error) {
    await audit('ratings', 'title', imdbId, 'ratings_refresh_failed', {
      provider: 'mdblist', error: error?.message || String(error), status: error?.status || null, duration_ms: Date.now() - started,
    });
    throw error;
  }
}

export const refreshRatings = refreshRatingsForTitle;
