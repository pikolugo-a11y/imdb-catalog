import 'server-only';
import {db} from './db';
import {LIFECYCLE} from './lifecycle';
import {PIKOQUALITY_ACTIVE_VERSION} from './pikoquality-version.mjs';
import {buildQualityHome} from './quality-home-domain.mjs';
import {getSeriesQualityCounts} from './series-quality-query';
import {getPeopleQualityHomeSummary} from './people-quality-home';

export async function getQualityHomeSnapshot(){
  const sql=db();
  const [stateRows,[meta],series,people,[tech]]=await Promise.all([
    sql`SELECT lifecycle_state,count(*)::int count FROM catalog_lifecycle GROUP BY lifecycle_state`,
    sql`SELECT
      (SELECT count(*)::int FROM movies) total,
      (SELECT count(*)::int FROM movies m LEFT JOIN catalog_lifecycle cl USING(imdb_id) LEFT JOIN catalog_exclusions ex USING(imdb_id) WHERE cl.imdb_id IS NULL AND ex.imdb_id IS NULL) missing,
      (SELECT count(*)::int FROM catalog_lifecycle cl LEFT JOIN movies m USING(imdb_id) WHERE m.imdb_id IS NULL) orphaned,
      (SELECT count(*)::int FROM catalog_lifecycle cl JOIN movies m USING(imdb_id) WHERE (m.type IN ('Serie','Miniserie') AND cl.lifecycle_state IN ('MOVIE_FILE_PENDING','MOVIE_FILE_REVIEW')) OR (m.type='Película' AND cl.lifecycle_state IN ('SERIES_SYNC_PENDING','SERIES_REVIEW'))) incompatible`,
    getSeriesQualityCounts(sql),getPeopleQualityHomeSummary(),
    sql`WITH pending_titles AS (
      SELECT cl.imdb_id,m.type,pcs.rating_key
      FROM catalog_lifecycle cl
      JOIN movies m USING(imdb_id)
      LEFT JOIN plex_catalog_status pcs USING(imdb_id)
      WHERE cl.lifecycle_state='TECH_PENDING'
    )
    SELECT count(*) FILTER(WHERE CASE WHEN t.type='Película' THEN NOT EXISTS(
      SELECT 1 FROM plex_items p
      JOIN plex_technical_state pts ON pts.rating_key=p.rating_key AND pts.snapshot_status='ready' AND pts.technical_fingerprint IS NOT NULL
      JOIN piko_quality q ON q.rating_key=p.rating_key AND q.status='evaluated' AND q.formula_version=${PIKOQUALITY_ACTIVE_VERSION} AND q.source_fingerprint IS NOT DISTINCT FROM pts.technical_fingerprint
      WHERE p.rating_key=t.rating_key AND p.active AND p.item_type='movie'
    ) ELSE EXISTS(
      SELECT 1 FROM series_reference sr
      JOIN plex_items p ON p.grandparent_rating_key=sr.show_rating_key AND p.active AND p.item_type='episode'
      LEFT JOIN plex_technical_state pts ON pts.rating_key=p.rating_key AND pts.snapshot_status='ready' AND pts.technical_fingerprint IS NOT NULL
      LEFT JOIN piko_quality q ON q.rating_key=p.rating_key AND q.status='evaluated' AND q.formula_version=${PIKOQUALITY_ACTIVE_VERSION} AND q.source_fingerprint IS NOT DISTINCT FROM pts.technical_fingerprint
      WHERE sr.imdb_id=t.imdb_id AND (pts.rating_key IS NULL OR q.rating_key IS NULL)
    ) END)::int pending FROM pending_titles t`
  ]);
  const counts={};let unknown=0;
  for(const row of stateRows){counts[row.lifecycle_state]=Number(row.count||0);if(!LIFECYCLE[row.lifecycle_state])unknown+=Number(row.count||0);}
  const materialized=Object.values(counts).reduce((a,b)=>a+Number(b||0),0);
  const rawTechPending=Number(counts.TECH_PENDING||0),effectiveTechPending=Number(tech?.pending||0),resolvedTech=Math.max(0,rawTechPending-effectiveTechPending);
  if(rawTechPending){counts.TECH_PENDING=effectiveTechPending;counts.COMPLETE=Number(counts.COMPLETE||0)+resolvedTech;}
  const stageCounts={
    recovery:Number(meta?.missing||0),
    movies:Number(counts.MOVIE_FILE_REVIEW||0),
    series:Number(series?.attention||0),
    people:Number(people?.pending||0),
    pikoquality:effectiveTechPending
  };
  const trackingExtras={movies:Number(counts.MOVIE_FILE_PENDING||0),series:Number(series?.tracking||0)};
  return buildQualityHome({total:Number(meta?.total||0),materialized,missing:Number(meta?.missing||0),counts,stageCounts,trackingExtras,integrity:{orphaned:Number(meta?.orphaned||0),unknown,incompatible:Number(meta?.incompatible||0)}});
}
