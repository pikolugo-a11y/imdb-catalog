import { neon } from '@neondatabase/serverless';

const databaseUrl = process.env.DATABASE_URL;
const tmdbToken = process.env.TMDB_API_TOKEN;
const persistMode = process.env.PERSIST_MODE === 'commit' ? 'commit' : 'dry-run';

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

function resolveImdbRating(cached) {
  if (cached?.imdb_rating == null || cached?.imdb_votes == null) {
    return { found: false, rating: null, votes: null, source: 'cache-miss' };
  }
  return {
    found: true,
    rating: Number(cached.imdb_rating),
    votes: Number(cached.imdb_votes),
    source: 'catalog_candidates'
  };
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

function parseFilmAffinityJsonLd(html) {
  const scripts = [...html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)];
  for (const match of scripts) {
    try {
      const data = JSON.parse(match[1].trim());
      const nodes = Array.isArray(data) ? data : [data];
      for (const node of nodes) {
        const aggregate = node?.aggregateRating;
        const rating = aggregate?.ratingValue != null ? Number(String(aggregate.ratingValue).replace(',', '.')) : null;
        const votes = aggregate?.ratingCount != null ? Number(String(aggregate.ratingCount).replace(/[^0-9]/g, '')) : null;
        if (Number.isFinite(rating) && Number.isFinite(votes)) {
          return { rating, votes, title: node?.name || null };
        }
      }
    } catch {}
  }
  return null;
}

async function resolveFilmAffinity(faId) {
  if (!faId) return { found: false, rating: null, votes: null, title: null, url: null, parse_method: 'no-id' };
  const url = `https://www.filmaffinity.com/es/film${faId}.html`;
  try {
    const html = await fetchText(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; PikoFilm/1.0; personal non-commercial)',
        'Accept-Language': 'es-ES,es;q=0.9'
      }
    });

    const structured = parseFilmAffinityJsonLd(html);
    if (structured) return { found: true, ...structured, url, parse_method: 'json-ld' };

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
      url,
      parse_method: scoreVoteMatch ? 'visible-text' : 'not-found'
    };
  } catch (error) {
    return { found: false, rating: null, votes: null, title: null, url, parse_method: 'request-error', error: error.message };
  }
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
    director: director ? { id: String(director.id), name: director.name, profile_path: director.profile_path || null, known_for_department: director.known_for_department || 'Directing' } : null,
    cast: (details.credits?.cast || []).slice(0, 15).map((c, index) => ({
      id: String(c.id), name: c.name, character: c.character || '', order: c.order ?? index,
      profile_path: c.profile_path || null, known_for_department: c.known_for_department || 'Acting'
    }))
  };
}

function computeCandidateScore(imdb, fa, tmdb) {
  const parts = [];
  if (imdb?.rating != null && imdb?.votes > 0) parts.push({ source: 'IMDb', rating: Number(imdb.rating), votes: Number(imdb.votes) });
  if (fa?.rating != null && fa?.votes > 0) parts.push({ source: 'FilmAffinity', rating: Number(fa.rating), votes: Number(fa.votes) });
  if (tmdb?.vote_average != null && tmdb?.vote_count > 0) parts.push({ source: 'TMDb', rating: Number(tmdb.vote_average), votes: Number(tmdb.vote_count) });
  if (!parts.length) return { score: null, sources: [] };

  const weighted = parts.map(p => ({ ...p, weight: Math.log10(p.votes + 10) }));
  const score = weighted.reduce((s, p) => s + p.rating * p.weight, 0) / weighted.reduce((s, p) => s + p.weight, 0);
  return { score: Number(score.toFixed(2)), sources: weighted };
}

async function buildCandidate(imdbId) {
  if (!/^tt\d+$/.test(imdbId)) throw new Error('IMDb ID inválido');
  const [plex, cachedImdb, wikidata, tmdb] = await Promise.all([
    getPlexSource(imdbId),
    getImdbCandidate(imdbId),
    resolveWikidata(imdbId),
    resolveTmdb(imdbId)
  ]);

  const imdb = resolveImdbRating(cachedImdb);
  const filmaffinity = await resolveFilmAffinity(wikidata?.filmaffinity_id);
  const pikoscore = computeCandidateScore(imdb, filmaffinity, tmdb);

  return {
    mode: persistMode,
    imdb_id: imdbId,
    writes_to_catalog: 0,
    plex,
    candidate: {
      type: tmdb?.media_type === 'tv' ? 'Serie' : 'Película',
      title_es: filmaffinity?.title || tmdb?.title_es || plex.plex_title,
      original_title: tmdb?.original_title || null,
      year: tmdb?.year || cachedImdb?.year || plex.plex_year || null,
      runtime: tmdb?.runtime || null,
      country: tmdb?.countries?.join(', ') || null,
      imdb_rating: imdb?.rating ?? null,
      imdb_votes: imdb?.votes ?? null,
      imdb_rating_source: imdb?.source || null,
      imdb_url: `https://www.imdb.com/title/${imdbId}/`,
      fa_id: wikidata?.filmaffinity_id || null,
      fa_rating: filmaffinity?.rating ?? null,
      fa_votes: filmaffinity?.votes ?? null,
      fa_parse_method: filmaffinity?.parse_method || null,
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
      release_date: tmdb?.release_date || null,
      genres: tmdb?.genres || [],
      collection: tmdb?.collection || null,
      director: tmdb?.director || null,
      cast: tmdb?.cast || []
    },
    source_status: {
      plex: true,
      imdb_cache_hit: Boolean(imdb?.found),
      imdb_rating_available: imdb?.rating != null,
      wikidata: Boolean(wikidata?.found),
      filmaffinity_id_found: Boolean(wikidata?.filmaffinity_id),
      filmaffinity_rating_fetched: filmaffinity?.rating != null,
      filmaffinity_error: filmaffinity?.error || null,
      tmdb: Boolean(tmdb?.found)
    }
  };
}

async function persistCandidate(result) {
  const c = result.candidate;
  if (!result.source_status.imdb_rating_available) throw new Error('Commit bloqueado: falta rating/votos IMDb en caché. Ejecuta antes el refresco IMDb.');
  if (!result.source_status.tmdb) throw new Error('Commit bloqueado: TMDb no encontró el título.');
  if (!c.title_es || !c.year || !c.tmdb_id) throw new Error('Commit bloqueado: ficha mínima incompleta.');

  const sourceStatus = JSON.stringify({
    imdb: c.imdb_rating != null ? 'ok' : 'missing',
    filmaffinity: c.fa_rating != null ? 'ok' : (c.fa_id ? 'partial' : 'missing'),
    tmdb: 'ok',
    wikidata: result.source_status.wikidata ? 'ok' : 'missing',
    enriched_by: 'issue-14-worker',
    enriched_at: new Date().toISOString()
  });

  const lockRows = await sql`SELECT pg_try_advisory_lock(hashtext('pikofilm:catalog-enrichment')) AS acquired`;
  if (!lockRows[0]?.acquired) throw new Error('Commit bloqueado: ya hay otra inclusión en curso.');

  try {
    const operations = [
      sql`
        INSERT INTO movies (
          imdb_id,type,title,title_es,original_title,year,runtime,country,origin,final_rating,
          imdb_rating,imdb_votes,imdb_url,fa_id,fa_rating,fa_votes,fa_url,
          tmdb_id,tmdb_rating,tmdb_votes,tmdb_url,wikidata_id,source_status,source_generated_at,
          synced_at,poster_path,backdrop_path,artwork_synced_at,artwork_source,inclusion_origin
        ) VALUES (
          ${result.imdb_id},${c.type},${c.title_es},${c.title_es},${c.original_title},${c.year},${c.runtime},${c.country},'plex_manual',${c.final_rating_preview},
          ${c.imdb_rating},${c.imdb_votes},${c.imdb_url},${c.fa_id},${c.fa_rating},${c.fa_votes},${c.fa_url},
          ${c.tmdb_id},${c.tmdb_rating},${c.tmdb_votes},${c.tmdb_url},${c.wikidata_id},${sourceStatus}::jsonb,now(),
          now(),${c.poster_path},${c.backdrop_path},now(),'tmdb','plex_manual'
        )
        ON CONFLICT (imdb_id) DO UPDATE SET
          type=EXCLUDED.type,title=EXCLUDED.title,title_es=EXCLUDED.title_es,original_title=EXCLUDED.original_title,
          year=EXCLUDED.year,runtime=EXCLUDED.runtime,country=EXCLUDED.country,final_rating=EXCLUDED.final_rating,
          imdb_rating=EXCLUDED.imdb_rating,imdb_votes=EXCLUDED.imdb_votes,imdb_url=EXCLUDED.imdb_url,
          fa_id=EXCLUDED.fa_id,fa_rating=EXCLUDED.fa_rating,fa_votes=EXCLUDED.fa_votes,fa_url=EXCLUDED.fa_url,
          tmdb_id=EXCLUDED.tmdb_id,tmdb_rating=EXCLUDED.tmdb_rating,tmdb_votes=EXCLUDED.tmdb_votes,tmdb_url=EXCLUDED.tmdb_url,
          wikidata_id=EXCLUDED.wikidata_id,source_status=EXCLUDED.source_status,source_generated_at=now(),synced_at=now(),
          poster_path=EXCLUDED.poster_path,backdrop_path=EXCLUDED.backdrop_path,artwork_synced_at=now(),artwork_source='tmdb',inclusion_origin='plex_manual'
      `,
      sql`
        INSERT INTO movie_metadata (imdb_id,overview,original_language,release_date,metadata_enriched_at,metadata_source)
        VALUES (${result.imdb_id},${c.overview},${c.original_language},${c.release_date || null},now(),'tmdb')
        ON CONFLICT (imdb_id) DO UPDATE SET overview=EXCLUDED.overview,original_language=EXCLUDED.original_language,
          release_date=EXCLUDED.release_date,metadata_enriched_at=now(),metadata_source='tmdb'
      `,
      sql`DELETE FROM movie_genres WHERE imdb_id=${result.imdb_id}`,
      ...c.genres.map(genre => sql`INSERT INTO movie_genres (imdb_id,genre) VALUES (${result.imdb_id},${genre}) ON CONFLICT DO NOTHING`),
      sql`DELETE FROM movie_credits WHERE imdb_id=${result.imdb_id}`
    ];

    const people = [];
    if (c.director) people.push(c.director);
    for (const person of c.cast) people.push(person);

    for (const person of people) {
      operations.push(sql`
        INSERT INTO people (tmdb_person_id,name,profile_path,known_for_department,updated_at)
        VALUES (${person.id},${person.name},${person.profile_path || null},${person.known_for_department || null},now())
        ON CONFLICT (tmdb_person_id) DO UPDATE SET name=EXCLUDED.name,profile_path=EXCLUDED.profile_path,
          known_for_department=COALESCE(EXCLUDED.known_for_department,people.known_for_department),updated_at=now()
      `);
    }

    if (c.director) operations.push(sql`
      INSERT INTO movie_credits (imdb_id,tmdb_person_id,credit_type,character_name,job,credit_order)
      VALUES (${result.imdb_id},${c.director.id},'crew','','Director',NULL) ON CONFLICT DO NOTHING
    `);
    for (const actor of c.cast) operations.push(sql`
      INSERT INTO movie_credits (imdb_id,tmdb_person_id,credit_type,character_name,job,credit_order)
      VALUES (${result.imdb_id},${actor.id},'cast',${actor.character || ''},'',${actor.order}) ON CONFLICT DO NOTHING
    `);

    operations.push(sql`DELETE FROM movie_collections WHERE imdb_id=${result.imdb_id}`);
    if (c.collection) operations.push(sql`
      INSERT INTO movie_collections (imdb_id,tmdb_collection_id,collection_name,collection_poster_path,collection_backdrop_path,updated_at)
      VALUES (${result.imdb_id},${c.collection.id},${c.collection.name},${c.collection.poster_path},${c.collection.backdrop_path},now())
      ON CONFLICT (imdb_id) DO UPDATE SET tmdb_collection_id=EXCLUDED.tmdb_collection_id,collection_name=EXCLUDED.collection_name,
        collection_poster_path=EXCLUDED.collection_poster_path,collection_backdrop_path=EXCLUDED.collection_backdrop_path,updated_at=now()
    `);

    await sql.transaction(operations);
    return { ...result, writes_to_catalog: 1, committed: true };
  } finally {
    await sql`SELECT pg_advisory_unlock(hashtext('pikofilm:catalog-enrichment'))`;
  }
}

async function main() {
  const imdbId = process.env.TEST_IMDB_ID;
  if (!imdbId) throw new Error('Falta TEST_IMDB_ID');
  const result = await buildCandidate(imdbId);
  const output = persistMode === 'commit' ? await persistCandidate(result) : result;
  console.log(JSON.stringify(output, null, 2));
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
