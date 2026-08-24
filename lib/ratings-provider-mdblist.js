import 'server-only';
import { RATING_SOURCES } from './title-ratings';

const SOURCE_MAP = {
  imdb: { source: RATING_SOURCES.IMDB, scale: 10, ratingType: 'audience' },
  tmdb: { source: RATING_SOURCES.TMDB, scale: 10, ratingType: 'audience' },
  trakt: { source: RATING_SOURCES.TRAKT, scale: 10, ratingType: 'audience' },
  letterboxd: { source: RATING_SOURCES.LETTERBOXD, scale: 5, ratingType: 'cinephile' },
  tomatoes: { source: RATING_SOURCES.RT_CRITICS, scale: 100, ratingType: 'critics' },
  rottentomatoes: { source: RATING_SOURCES.RT_CRITICS, scale: 100, ratingType: 'critics' },
  audience: { source: RATING_SOURCES.RT_AUDIENCE, scale: 100, ratingType: 'audience' },
  popcorn: { source: RATING_SOURCES.RT_AUDIENCE, scale: 100, ratingType: 'audience' },
  metacritic: { source: RATING_SOURCES.METACRITIC, scale: 100, ratingType: 'critics' },
  metacriticuser: { source: RATING_SOURCES.METACRITIC_USER, scale: 10, ratingType: 'audience' },
  rogerebert: { source: RATING_SOURCES.ROGER_EBERT, scale: 4, ratingType: 'critics' },
};

function sourceKey(value) {
  return String(value || '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

export function parseMDBListRatings(payload) {
  const ratings = Array.isArray(payload?.ratings) ? payload.ratings : [];
  const result = [];
  for (const item of ratings) {
    const mapping = SOURCE_MAP[sourceKey(item?.source)];
    if (!mapping) continue;
    const rating = Number(item?.value ?? item?.rating);
    if (!Number.isFinite(rating)) continue;
    const votesRaw = item?.votes ?? item?.vote_count ?? null;
    const votes = votesRaw == null ? null : Number(votesRaw);
    result.push({
      ...mapping,
      rating,
      votes: Number.isFinite(votes) ? votes : null,
      provider: 'mdblist',
      rawPayload: item,
    });
  }
  return result;
}

export async function fetchMDBListRatings({ imdbId, mediaType = 'movie', signal } = {}) {
  const apiKey = process.env.MDBLIST_API_KEY;
  if (!apiKey) throw new Error('MDBLIST_API_KEY no está configurada');
  const type = ['show', 'series', 'tv', 'miniseries'].includes(String(mediaType).toLowerCase()) ? 'show' : 'movie';
  const url = `https://api.mdblist.com/imdb/${type}/${encodeURIComponent(imdbId)}`;
  const response = await fetch(url, {
    headers: { 'X-API-Key': apiKey, Accept: 'application/json' },
    signal,
    cache: 'no-store',
  });
  if (!response.ok) {
    const body = await response.text().catch(() => '');
    const error = new Error(`MDBList HTTP ${response.status}${body ? `: ${body.slice(0, 300)}` : ''}`);
    error.status = response.status;
    throw error;
  }
  const payload = await response.json();
  return { payload, ratings: parseMDBListRatings(payload) };
}
