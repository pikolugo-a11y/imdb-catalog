import 'server-only';
import {db} from './db';

export async function getQualityDashboard(){
  const sql=db();
  const [movie,series,identity,plexIdentity,pq]=await Promise.all([
    sql`SELECT count(DISTINCT rating_key) FILTER(WHERE status='pending')::int affected,
      count(*) FILTER(WHERE status='pending')::int findings,
      count(*) FILTER(WHERE status='pending' AND finding_type='duplicate')::int duplicates,
      count(*) FILTER(WHERE status='pending' AND finding_type='duration')::int duration,
      count(*) FILTER(WHERE status='pending' AND finding_type='filename')::int filename,
      count(*) FILTER(WHERE status='pending' AND finding_type='quality')::int quality
      FROM movie_quality_findings`,
    sql`WITH ec AS(
      SELECT r.show_rating_key,
        count(*) FILTER(WHERE e.effective_status='missing_actionable')::int missing,
        count(*) FILTER(WHERE e.effective_status='availability_unknown')::int unknown
      FROM series_reference r
      JOIN plex_items sh ON sh.rating_key=r.show_rating_key AND sh.active AND sh.item_type='show'
      LEFT JOIN series_episode_effective_status e ON e.show_rating_key=r.show_rating_key
      LEFT JOIN catalog_exclusions ex ON ex.imdb_id=r.imdb_id
      WHERE ex.imdb_id IS NULL GROUP BY r.show_rating_key
    ), extras AS(
      SELECT r.show_rating_key,count(p.*) FILTER(WHERE ref.show_rating_key IS NULL)::int extra
      FROM series_reference r
      JOIN plex_items sh ON sh.rating_key=r.show_rating_key AND sh.active AND sh.item_type='show'
      LEFT JOIN plex_items p ON p.grandparent_rating_key=r.show_rating_key AND p.active AND p.item_type='episode'
      LEFT JOIN series_reference_episodes ref ON ref.show_rating_key=r.show_rating_key AND ref.season_number=p.parent_index AND ref.episode_number=p.item_index
      LEFT JOIN catalog_exclusions ex ON ex.imdb_id=r.imdb_id
      WHERE ex.imdb_id IS NULL GROUP BY r.show_rating_key
    ) SELECT
      count(*) FILTER(WHERE COALESCE(ec.missing,0)>0)::int actionable_series,
      COALESCE(sum(ec.missing),0)::int missing_episodes,
      count(*) FILTER(WHERE COALESCE(extras.extra,0)>0)::int anomaly_series,
      COALESCE(sum(extras.extra),0)::int extra_episodes,
      count(*) FILTER(WHERE COALESCE(ec.unknown,0)>0)::int unknown_series,
      COALESCE(sum(ec.unknown),0)::int unknown_episodes
      FROM ec LEFT JOIN extras USING(show_rating_key)`,
    sql`SELECT
      count(DISTINCT m.imdb_id) FILTER(WHERE m.tmdb_id IS NULL OR m.fa_id IS NULL OR COALESCE((m.source_status->>'tmdb'),'')='mismatch' OR COALESCE((m.source_status->>'filmaffinity'),'')='mismatch')::int affected,
      count(*) FILTER(WHERE m.tmdb_id IS NULL)::int missing_tmdb,
      count(*) FILTER(WHERE m.fa_id IS NULL)::int missing_fa,
      count(*) FILTER(WHERE COALESCE((m.source_status->>'tmdb'),'')='mismatch' OR COALESCE((m.source_status->>'filmaffinity'),'')='mismatch')::int doubtful
      FROM movies m LEFT JOIN catalog_exclusions ex USING(imdb_id) WHERE ex.imdb_id IS NULL`,
    sql`SELECT count(*)::int total FROM plex_items p WHERE p.active AND p.item_type IN('movie','show') AND NOT EXISTS(SELECT 1 FROM plex_external_ids x WHERE x.rating_key=p.rating_key AND x.provider='imdb')`,
    sql`SELECT count(*)::int total,
      count(*) FILTER(WHERE q.status='evaluated')::int evaluated,
      round(avg(q.score) FILTER(WHERE q.status='evaluated')::numeric,1) avg_score,
      count(*) FILTER(WHERE q.status='error')::int errors,
      max(q.evaluated_at) last_evaluation
      FROM plex_items p LEFT JOIN piko_quality q ON q.rating_key=p.rating_key
      WHERE p.active AND p.item_type IN('movie','episode')`
  ]);
  const m=movie[0]||{},s=series[0]||{},i=identity[0]||{},pi=plexIdentity[0]||{},q=pq[0]||{};
  const identityAffected=Number(i.affected||0)+Number(pi.total||0);
  const seriesAffected=Number(s.actionable_series||0)+Number(s.anomaly_series||0)+Number(s.unknown_series||0);
  const totalAttention=Number(m.affected||0)+identityAffected+seriesAffected;
  const progress=Number(q.total||0)?Math.round(Number(q.evaluated||0)*1000/Number(q.total))/10:0;
  return {totalAttention,movie:m,series:s,identity:{...i,missing_plex_imdb:pi.total||0,affected:identityAffected},pikoquality:{...q,progress}};
}
