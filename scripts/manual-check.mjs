import { neon } from '@neondatabase/serverless';

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error('DATABASE_URL is required');

const task = process.env.TASK || 'database-health';
const rawLimit = Number.parseInt(process.env.LIMIT || '5', 10);
const limit = Math.max(1, Math.min(Number.isFinite(rawLimit) ? rawLimit : 5, 10));
const sql = neon(databaseUrl);

if (task === 'database-health') {
  const [row] = await sql`
    SELECT
      (SELECT count(*)::int FROM catalog_read_model) AS catalog_total,
      (SELECT count(*)::int FROM plex_items WHERE active) AS plex_active,
      (SELECT count(*)::int FROM plex_review_tasks WHERE status = 'pending') AS review_pending,
      (SELECT count(*)::int FROM series_episode_effective_status WHERE effective_status = 'availability_unknown') AS availability_unknown
  `;
  console.log(JSON.stringify(row, null, 2));
} else if (task === 'series-sample') {
  const rows = await sql`
    SELECT r.title, r.year,
           count(*) FILTER (WHERE e.effective_status = 'missing_actionable')::int AS missing_actionable,
           count(*) FILTER (WHERE e.effective_status = 'availability_unknown')::int AS availability_unknown
    FROM series_reference r
    JOIN series_episode_effective_status e ON e.show_rating_key = r.show_rating_key
    GROUP BY r.show_rating_key, r.title, r.year
    HAVING count(*) FILTER (WHERE e.effective_status <> 'present') > 0
    ORDER BY availability_unknown DESC, r.title
    LIMIT ${limit}
  `;
  console.log(JSON.stringify(rows, null, 2));
} else {
  throw new Error(`Unsupported task: ${task}`);
}
