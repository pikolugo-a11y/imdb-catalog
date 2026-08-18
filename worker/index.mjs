import { neon } from '@neondatabase/serverless';

const databaseUrl = process.env.DATABASE_URL;
const tmdbToken = process.env.TMDB_API_TOKEN;

if (!databaseUrl) throw new Error('Falta DATABASE_URL');
if (!tmdbToken) throw new Error('Falta TMDB_API_TOKEN');

const sql = neon(databaseUrl);

async function fetchJson(url, options = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);
  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    if (!response.ok) throw new Error(`HTTP ${response.status} en ${new URL(url).hostname}`);
    return await response.json();
  } finally {
    clearTimeout(timer);
  }
}

async function getPlexSource(imdbId) {
  const rows = await sql`
    SELECT rating_key, plex_title, plex_year, imdb_id, catalog_state
    FROM plex_not_in_catalog
    WHERE imdb_id = ${imdbId}
    LIMIT 1
  `;
  if (!rows[0]) throw new Error(`${imdbId} no está en plex_not_in_catalog`);
  return rows[0];
}

async function getImdbCandidate(imdbId) {
  const rows = await sql`
    SELECT imdb_id, candidate_type, year, imdb_rating, imdb_votes, source_snapshot
    FROM catalog_candidates
    WHERE imdb_id = ${imdbId}
    LIMIT 1
  `;
  return rows[0] || null;
}

async function resolveWikidata(imdbId) {
  const sparql = `SELECT ?item ?fa WHERE { ?item wdt:P345 "${imdbId}". OPTIONAL { ?item wdt:P480 ?fa. } } LIMIT 5`;
  const url = `https://query.wikidata.org/sparql?query=${encodeURIComponent(sparql)}&format=json`;
  const data = await fetchJson(url, {
    headers: {
      Accept: 'application/sparql-results+json',
      'User-Agent': 'PikoFilm/1.0 catalog-enrichment-test'
    }
  });
  const binding = data?.results?.bindings?.[0];
  return binding ? {
    found: true,
    wikidata_item: binding.item?.value?.split('/').pop() || null,
    filmaffinity_id: binding.fa?.value || null
  } : { found: false, wikidata_item: null, filmaffinity_id: null };
}

async function resolveTmdb(imdbId) {
  const headers = { Authorization: `Bearer ${tmdbToken}`, Accept: 'application/json' };
  const find = await fetchJson(`https://api.themoviedb.org/3/find/${imdbId}?external_source=imdb_id&language=es-ES`, { headers });
  const movie = find?.movie_results?.[0];
  const tv = find?.tv_results?.[0];
  const hit = movie || tv;
  if (!hit) return { found: false, media_type: null, id: null };

  const mediaType = movie ? 'movie' : 'tv';
  const details = await fetchJson(`https://api.themoviedb.org/3/${mediaType}/${hit.id}?language=es-ES&append_to_response=credits,external_ids`, { headers });
  const director = (details.credits?.crew || []).find(c => c.job === 'Director') || null;

  return {
    found: true,
    media_type: mediaType,
    id: String(hit.id),
    title_es: details.title || details.name || null,
    original_title: details.original_title || details.original_name || null,
    release_date: details.release_date || details.first_air_date || null,
    year: Number(String(details.release_date || details.first_air_date || '').slice(0, 4)) || null,
    runtime: details.runtime || details.episode_run_time?.[0] || null,
    vote_average: details.vote_average ?? null,
    vote_count: details.vote_count ?? null,
    poster_path: details.poster_path || null,
    backdrop_path: details.backdrop_path || null,
    overview: details.overview || null,
    original_language: details.original_language || null,
    countries: (details.production_countries || details.origin_country || []).map(c => c.name || c).filter(Boolean),
    genres: (details.genres || []).map(g => g.name),
    collection: details.belongs_to_collection ? {
      id: String(details.belongs_to_collection.id),
      name: details.belongs_to_collection.name || null,
      poster_path: details.belongs_to_collection.poster_path || null,
      backdrop_path: details.belongs_to_collection.backdrop_path || null
    } : null,
    director: director ? { id: String(director.id), name: director.name, profile_path: director.profile_path || null } : null,
    cast: (details.credits?.cast || []).slice(0, 15).map((c, index) => ({
      id: String(c.id), name: c.name, character: c.character || '', order: c.order ?? index,
      profile_path: c.profile_path || null, known_for_department: c.known_for_department || null
    }))
  };
}

function computeCandidateScore(imdb, tmdb) {
  const parts = [];
  if (imdb?.imdb_rating != null && imdb?.imdb_votes > 0) parts.push({ rating: Number(imdb.imdb_rating), weight: Math.log10(Number(imdb.imdb_votes) + 10) });
  if (tmdb?.vote_average != null && tmdb?.vote_count > 0) parts.push({ rating: Number(tmdb.vote_average), weight: Math.log10(Number(tmdb.vote_count) + 10) });
  if (!parts.length) return null;
  return Number((parts.reduce((s, p) => s + p.rating * p.weight, 0) / parts.reduce((s, p) => s + p.weight, 0)).toFixed(2));
}

async function buildDryRun(imdbId) {
  if (!/^tt\d+$/.test(imdbId)) throw new Error('IMDb ID inválido');
  const [plex, imdb, wikidata, tmdb] = await Promise.all([
    getPlexSource(imdbId),
    getImdbCandidate(imdbId),
    resolveWikidata(imdbId),
    resolveTmdb(imdbId)
  ]);

  return {
    dry_run: true,
    imdb_id: imdbId,
    writes_to_catalog: 0,
    plex,
    candidate: {
      type: tmdb?.media_type === 'tv' ? 'Serie' : 'Película',
      title_es: tmdb?.title_es || plex.plex_title,
      original_title: tmdb?.original_title || null,
      year: tmdb?.year || imdb?.year || plex.plex_year || null,
      runtime: tmdb?.runtime || null,
      country: tmdb?.countries?.join(', ') || null,
      imdb_rating: imdb?.imdb_rating ?? null,
      imdb_votes: imdb?.imdb_votes ?? null,
      imdb_url: `https://www.imdb.com/title/${imdbId}/`,
      fa_id: wikidata?.filmaffinity_id || null,
      fa_url: wikidata?.filmaffinity_id ? `https://www.filmaffinity.com/es/film${wikidata.filmaffinity_id}.html` : null,
      tmdb_id: tmdb?.id || null,
      tmdb_rating: tmdb?.vote_average ?? null,
      tmdb_votes: tmdb?.vote_count ?? null,
      tmdb_url: tmdb?.id ? `https://www.themoviedb.org/${tmdb.media_type}/${tmdb.id}` : null,
      wikidata_id: wikidata?.wikidata_item || null,
      final_rating_preview: computeCandidateScore(imdb, tmdb),
      poster_path: tmdb?.poster_path || null,
      backdrop_path: tmdb?.backdrop_path || null,
      overview: tmdb?.overview || null,
      original_language: tmdb?.original_language || null,
      genres: tmdb?.genres || [],
      collection: tmdb?.collection || null,
      director: tmdb?.director || null,
      cast: tmdb?.cast || []
    },
    source_status: {
      plex: true,
      imdb_candidate: Boolean(imdb),
      wikidata: Boolean(wikidata?.found),
      filmaffinity_id_found: Boolean(wikidata?.filmaffinity_id),
      tmdb: Boolean(tmdb?.found),
      filmaffinity_rating_fetched: false
    }
  };
}

async function main() {
  const imdbId = process.env.TEST_IMDB_ID;
  if (!imdbId) throw new Error('Falta TEST_IMDB_ID');
  const result = await buildDryRun(imdbId);
  console.log(JSON.stringify(result, null, 2));
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
