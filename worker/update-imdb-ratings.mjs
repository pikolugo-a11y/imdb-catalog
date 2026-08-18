import { neon } from '@neondatabase/serverless';
import { createGunzip } from 'node:zlib';
import { Readable } from 'node:stream';
import { createInterface } from 'node:readline';

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error('Falta DATABASE_URL');

const sql = neon(databaseUrl);
const DATASET_URL = 'https://datasets.imdbws.com/title.ratings.tsv.gz';
const BATCH_SIZE = 500;

async function ensurePlexCandidates() {
  await sql`
    INSERT INTO catalog_candidates (
      imdb_id, candidate_type, year, eligibility_status,
      first_seen_at, last_seen_at, created_at, updated_at
    )
    SELECT p.imdb_id, 'movie', p.plex_year, 'not_eligible',
           now(), now(), now(), now()
    FROM plex_not_in_catalog p
    WHERE p.imdb_id IS NOT NULL
      AND p.imdb_id ~ '^tt[0-9]+$'
    ON CONFLICT (imdb_id) DO UPDATE
      SET last_seen_at = now(),
          year = COALESCE(catalog_candidates.year, EXCLUDED.year),
          updated_at = now()
  `;
}

async function getTargetIds() {
  const rows = await sql`
    SELECT DISTINCT imdb_id
    FROM (
      SELECT imdb_id FROM movies WHERE imdb_id IS NOT NULL
      UNION ALL
      SELECT imdb_id FROM catalog_candidates WHERE imdb_id IS NOT NULL
    ) q
    WHERE imdb_id ~ '^tt[0-9]+$'
  `;
  return new Set(rows.map(r => r.imdb_id));
}

async function fetchDatasetStream() {
  const response = await fetch(DATASET_URL, {
    headers: { 'User-Agent': 'PikoFilm/1.0 personal-noncommercial-dataset-refresh' }
  });
  if (!response.ok || !response.body) {
    throw new Error(`No se pudo descargar IMDb ratings: HTTP ${response.status}`);
  }
  return Readable.fromWeb(response.body).pipe(createGunzip());
}

async function updateBatch(batch) {
  if (!batch.length) return;
  const payload = JSON.stringify(batch);

  await sql`
    WITH incoming AS (
      SELECT * FROM jsonb_to_recordset(${payload}::jsonb)
        AS x(imdb_id text, rating double precision, votes integer)
    )
    UPDATE catalog_candidates c
    SET imdb_rating = i.rating,
        imdb_votes = i.votes,
        last_evaluated_at = now(),
        source_snapshot = COALESCE(c.source_snapshot, '{}'::jsonb) || jsonb_build_object(
          'imdb_ratings_dataset_updated_at', now(),
          'imdb_ratings_source', 'title.ratings.tsv.gz'
        ),
        updated_at = now()
    FROM incoming i
    WHERE c.imdb_id = i.imdb_id
  `;

  await sql`
    WITH incoming AS (
      SELECT * FROM jsonb_to_recordset(${payload}::jsonb)
        AS x(imdb_id text, rating double precision, votes integer)
    )
    UPDATE movies m
    SET imdb_rating = i.rating,
        imdb_votes = i.votes,
        source_status = COALESCE(m.source_status, '{}'::jsonb) || jsonb_build_object(
          'imdb_ratings', 'dataset',
          'imdb_ratings_updated_at', now()
        ),
        source_generated_at = now(),
        synced_at = now()
    FROM incoming i
    WHERE m.imdb_id = i.imdb_id
  `;
}

async function main() {
  const started = Date.now();
  await ensurePlexCandidates();
  const targets = await getTargetIds();
  console.log(`IMDb ratings refresh: ${targets.size} IDs objetivo`);

  const stream = await fetchDatasetStream();
  const rl = createInterface({ input: stream, crlfDelay: Infinity });

  let scanned = 0;
  let matched = 0;
  let batch = [];
  let headerSkipped = false;

  for await (const line of rl) {
    if (!headerSkipped) {
      headerSkipped = true;
      continue;
    }
    scanned++;
    const [imdbId, ratingText, votesText] = line.split('\t');
    if (!targets.has(imdbId)) continue;

    const rating = Number(ratingText);
    const votes = Number(votesText);
    if (!Number.isFinite(rating) || !Number.isInteger(votes)) continue;

    batch.push({ imdb_id: imdbId, rating, votes });
    matched++;

    if (batch.length >= BATCH_SIZE) {
      await updateBatch(batch);
      batch = [];
    }
  }

  await updateBatch(batch);

  console.log(JSON.stringify({
    success: true,
    source: DATASET_URL,
    targets: targets.size,
    scanned_rows: scanned,
    matched_rows: matched,
    elapsed_seconds: Math.round((Date.now() - started) / 1000)
  }, null, 2));
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
