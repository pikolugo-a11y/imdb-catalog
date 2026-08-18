import { neon } from '@neondatabase/serverless';

const databaseUrl = process.env.DATABASE_URL;
const tmdbToken = process.env.TMDB_API_TOKEN;

if (!databaseUrl) throw new Error('Falta DATABASE_URL');
if (!tmdbToken) throw new Error('Falta TMDB_API_TOKEN');

const sql = neon(databaseUrl);

async function fetchText(url, options = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);
  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    if (!response.ok) throw new Error(`HTTP ${response.status} en ${new URL(url).hostname}`);
    return await response.text();
  } finally {
    clearTimeout(timer);
  }
}

async function fetchJson(url, options = {}) {
  return JSON.parse(await fetchText(url, options));
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

function htmlToText(html) {
  return html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&#39;/gi, "'")
    .replace(/&quot;/gi, '"')
    .replace(/\s+/g, ' ')
    .trim();
}

async function resolveFilmAffinity(faId) {
  if (!faId) return { found: false, rating: null, votes: null, title: null, url: null };
  const url = `https://www.filmaffinity.com/es/film${faId}.html`;
  const html = await fetchText(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 PikoFilm/1.0 personal-noncommercial',
      'Accept-Language': 'es-ES,es;q=0.9'
    }
  });
  const text = htmlToText(html);

  const titleMatch = text.match(/(?:copiar la URL\s*)?([^|]{1,160}?)\s+(?:Ficha\s+Créditos|Ficha\s+Creditos)/i);
  const scoreVoteMatch = text.match(/\b([0-9],[0-9])\s+([0-9][0-9\.]{0,12})\s+votos\b/i);
  const rating = scoreVoteMatch ? Number(scoreVoteMatch[1].replace(',', '.')) : null;
  const votes = scoreVoteMatch ? Number(scoreVoteMatch[2].replace(/\./g, '')) : null;

  return {
    found: true,
    rating: Number.isFinite(rating) ? rating : null,
    votes: Number.isInteger(votes) ? votes : null,
    title: titleMatch?.[1]?.trim() || null,
    url
  };
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

function computeCandidateScore(imdb, fa, tmdb) {
  const parts = [];
  if (imdb?.imdb_rating != null && imdb?.imdb_votes > 0) parts.push({ source: 'IMDb', rating: Number(imdb.imdb_rating), votes: Number(imdb.imdb_votes) });
  if (fa?.rating != null && fa?.votes > 0) parts.push({ source: 'FilmAffinity', rating: Number(fa.rating), votes: Number(fa.votes) });
  if (tmdb?.vote_average != null && tmdb?.vote_count > 0) parts.push({ source: 'TMDb', rating: Number(tmdb.vote_average), votes: Number(tmdb.vote_count) });
  if (!parts.length) return { score: null, sources: [] };

  const weighted = parts.map(p => ({ ...p, weight: Math.log10(p.votes + 10) }));
  const score = weighted.reduce((s, p) => s + p.rating * p.weight, 0) / weighted.reduce((s, p) => s + p.weight, 0);
  return { score: Number(score.toFixed(2)), sources: weighted };
}

async function buildDryRun(imdbId) {
  if (!/^tt\d+$/.test(imdbId)) throw new Error('IMDb ID inválido');
  const [plex, imdb, wikidata, tmdb] = await Promise.all([
    getPlexSource(imdbId),
    getImdbCandidate(imdbId),
    resolveWikidata(imdbId),
    resolveTmdb(imdbId)
  ]);

  const filmaffinity = await resolveFilmAffinity(wikidata?.filmaffinity_id);
  const pikoscore = computeCandidateScore(imdb, filmaffinity, tmdb);

  return {
    dry_run: true,
    imdb_id: imdbId,
    writes_to_catalog: 0,
    plex,
    candidate: {
      type: tmdb?.media_type === 'tv' ? 'Serie' : 'Película',
      title_es: filmaffinity?.title || tmdb?.title_es || plex.plex_title,
      original_title: tmdb?.original_title || null,
      year: tmdb?.year || imdb?.year || plex.plex_year || null,
      runtime: tmdb?.runtime || null,
      country: tmdb?.countries?.join(', ') || null,
      imdb_rating: imdb?.imdb_rating ?? null,
      imdb_votes: imdb?.imdb_votes ?? null,
      imdb_url: `https://www.imdb.com/title/${imdbId}/`,
      fa_id: wikidata?.filmaffinity_id || null,
      fa_rating: filmaffinity?.rating ?? null,
      fa_votes: filmaffinity?.votes ?? null,
      fa_url: filmaffinity?.url || null,
      tmdb_id: tmdb?.id || null,
      tmdb_rating: tmdb?.vote_average ?? null,
      tmdb_votes: tmdb?.vote_count ?? null,
      tmdb_url: tmdb?.id ? `https://www.themoviedb.org/${tmdb.media_type}/${tmdb.id}` : null,
      wikidata_id: wikidata?.wikidata_item || null,
      final_rating_preview: pikoscore.score,
      score_sources: pikoscore.sources,
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
      imdb_rating_available: imdb?.imdb_rating != null,
      wikidata: Boolean(wikidata?.found),
      filmaffinity_id_found: Boolean(wikidata?.filmaffinity_id),
      filmaffinity_rating_fetched: filmaffinity?.rating != null,
      tmdb: Boolean(tmdb?.found)
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
