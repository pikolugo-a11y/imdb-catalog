import { neon } from '@neondatabase/serverless';

const databaseUrl = process.env.DATABASE_URL;
const tmdbToken = process.env.TMDB_API_TOKEN;
const pollMs = Math.max(5000, Number(process.env.WORKER_POLL_MS || 15000));

if (!databaseUrl) throw new Error('Falta DATABASE_URL');
if (!tmdbToken) throw new Error('Falta TMDB_API_TOKEN');

const sql = neon(databaseUrl);
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

async function claimOneJob() {
  const rows = await sql`
    WITH candidate AS (
      SELECT id
      FROM admin_job_requests
      WHERE job_type = 'catalog_enrichment_test'
        AND status = 'pending'
        AND NOT EXISTS (
          SELECT 1 FROM admin_job_requests
          WHERE job_type = 'catalog_enrichment_test' AND status = 'running'
        )
      ORDER BY requested_at
      LIMIT 1
    )
    UPDATE admin_job_requests j
    SET status = 'running',
        dispatched_at = now(),
        external_run_id = 'render-dry-run-v1',
        error = NULL
    FROM candidate c
    WHERE j.id = c.id
    RETURNING j.id, j.payload, j.requested_at
  `;
  return rows[0] || null;
}

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

async function getBaseMovie(imdbId) {
  const rows = await sql`
    SELECT imdb_id, type, title, title_es, original_title, year, runtime,
           imdb_rating, imdb_votes, fa_rating, fa_votes, fa_url,
           tmdb_id, tmdb_rating, tmdb_votes, tmdb_url, final_rating
    FROM movies
    WHERE imdb_id = ${imdbId}
    LIMIT 1
  `;
  if (!rows[0]) throw new Error(`No existe ${imdbId} en movies`);
  return rows[0];
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
  if (!binding) return { found: false, filmaffinity_id: null, wikidata_item: null };
  return {
    found: true,
    wikidata_item: binding.item?.value?.split('/').pop() || null,
    filmaffinity_id: binding.fa?.value || null
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
  return {
    found: true,
    media_type: mediaType,
    id: hit.id,
    title: details.title || details.name || null,
    original_title: details.original_title || details.original_name || null,
    release_date: details.release_date || details.first_air_date || null,
    runtime: details.runtime || details.episode_run_time?.[0] || null,
    vote_average: details.vote_average ?? null,
    vote_count: details.vote_count ?? null,
    poster_path: details.poster_path || null,
    backdrop_path: details.backdrop_path || null,
    overview: details.overview || null,
    genres: (details.genres || []).map(g => g.name),
    cast_sample: (details.credits?.cast || []).slice(0, 5).map(c => ({ name: c.name, character: c.character || null }))
  };
}

async function processJob(job) {
  const imdbId = String(job.payload?.imdb_id || '');
  if (!/^tt\d+$/.test(imdbId)) throw new Error('payload.imdb_id inválido');

  const startedAt = new Date().toISOString();
  const base = await getBaseMovie(imdbId);
  const wikidata = await resolveWikidata(imdbId);
  const tmdb = await resolveTmdb(imdbId);

  return {
    dry_run: true,
    imdb_id: imdbId,
    started_at: startedAt,
    finished_at: new Date().toISOString(),
    sources: {
      imdb_base: {
        ok: true,
        title: base.title_es || base.title || base.original_title,
        original_title: base.original_title,
        year: base.year,
        runtime: base.runtime,
        rating: base.imdb_rating,
        votes: base.imdb_votes
      },
      wikidata_filmaffinity: {
        ok: wikidata.found,
        wikidata_item: wikidata.wikidata_item,
        filmaffinity_id: wikidata.filmaffinity_id,
        filmaffinity_url: wikidata.filmaffinity_id ? `https://www.filmaffinity.com/es/film${wikidata.filmaffinity_id}.html` : null
      },
      tmdb: { ok: tmdb.found, ...tmdb }
    },
    existing: {
      fa_rating: base.fa_rating,
      fa_votes: base.fa_votes,
      fa_url: base.fa_url,
      tmdb_id: base.tmdb_id,
      tmdb_rating: base.tmdb_rating,
      tmdb_votes: base.tmdb_votes,
      final_rating: base.final_rating
    },
    writes_to_catalog: 0
  };
}

async function finishJob(id, result) {
  const resultPatch = JSON.stringify({ result });
  await sql`
    UPDATE admin_job_requests
    SET status = 'success',
        finished_at = now(),
        payload = payload || ${resultPatch}::jsonb,
        error = NULL
    WHERE id = ${id}
  `;
}

async function failJob(id, error) {
  await sql`
    UPDATE admin_job_requests
    SET status = 'failed', finished_at = now(), error = ${String(error?.message || error).slice(0, 1000)}
    WHERE id = ${id}
  `;
}

async function main() {
  console.log(`PikoFilm worker dry-run iniciado. Poll=${pollMs}ms. Máximo 1 job por arranque.`);
  while (true) {
    const job = await claimOneJob();
    if (!job) {
      await sleep(pollMs);
      continue;
    }

    console.log(`Procesando job ${job.id} en modo dry-run`);
    try {
      const result = await processJob(job);
      await finishJob(job.id, result);
      console.log(`Job ${job.id} completado. writes_to_catalog=0`);
    } catch (error) {
      await failJob(job.id, error);
      console.error(`Job ${job.id} falló:`, error?.message || error);
    }

    console.log('Límite de seguridad alcanzado: este arranque no procesará más jobs.');
    await new Promise(() => {});
  }
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
