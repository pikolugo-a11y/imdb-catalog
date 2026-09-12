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
    sql`WITH current_pending AS (
      SELECT DISTINCT m.imdb_id
      FROM movies m
      JOIN plex_catalog_status pcs ON pcs.imdb_id=m.imdb_id AND pcs.status='in_plex'
      JOIN plex_items p ON p.rating_key=pcs.rating_key AND p.active AND p.item_type='movie'
      LEFT JOIN catalog_exclusions ex ON ex.imdb_id=m.imdb_id
      LEFT JOIN plex_technical_state pts ON pts.rating_key=p.rating_key AND pts.snapshot_status='ready' AND pts.technical_fingerprint IS NOT NULL
      LEFT JOIN piko_quality q ON q.rating_key=p.rating_key AND q.status='evaluated' AND q.formula_version=${PIKOQUALITY_ACTIVE_VERSION} AND q.source_fingerprint IS NOT DISTINCT FROM pts.technical_fingerprint
      WHERE m.type='Película' AND ex.imdb_id IS NULL AND (pts.rating_key IS NULL OR q.rating_key IS NULL)
      UNION
      SELECT DISTINCT sr.imdb_id
      FROM series_reference sr
      JOIN movies m ON m.imdb_id=sr.imdb_id AND m.type IN ('Serie','Miniserie')
      JOIN plex_items show ON show.rating_key=sr.show_rating_key AND show.active AND show.item_type='show'
      JOIN plex_items p ON p.grandparent_rating_key=sr.show_rating_key AND p.active AND p.item_type='episode'
      LEFT JOIN catalog_exclusions ex ON ex.imdb_id=sr.imdb_id
      LEFT JOIN plex_technical_state pts ON pts.rating_key=p.rating_key AND pts.snapshot_status='ready' AND pts.technical_fingerprint IS NOT NULL
      LEFT JOIN piko_quality q ON q.rating_key=p.rating_key AND q.status='evaluated' AND q.formula_version=${PIKOQUALITY_ACTIVE_VERSION} AND q.source_fingerprint IS NOT DISTINCT FROM pts.technical_fingerprint
      WHERE ex.imdb_id IS NULL AND (pts.rating_key IS NULL OR q.rating_key IS NULL)
    )
    SELECT count(*)::int pending,
      count(*) FILTER(WHERE cl.lifecycle_state='TECH_PENDING')::int stored_tech_pending,
      count(*) FILTER(WHERE cl.lifecycle_state='COMPLETE')::int pending_from_complete
    FROM current_pending p
    LEFT JOIN catalog_lifecycle cl USING(imdb_id)`
  ]);
  const counts={};let unknown=0;
  for(const row of stateRows){counts[row.lifecycle_state]=Number(row.count||0);if(!LIFECYCLE[row.lifecycle_state])unknown+=Number(row.count||0);}
  const materialized=Object.values(counts).reduce((a,b)=>a+Number(b||0),0);

  // Lifecycle histórico puede conservar TECH_PENDING calculados antes de la versión
  // C6 vigente. La portada usa la verdad física actual sin mutar datos al leer: los
  // TECH_PENDING ya resueltos cuentan como COMPLETE y una deuda PikoQuality nueva que
  // nazca sobre un título COMPLETE deja de inflar artificialmente el progreso.
  const rawTechPending=Number(counts.TECH_PENDING||0);
  const storedTechPending=Number(tech?.stored_tech_pending||0);
  const pendingFromComplete=Number(tech?.pending_from_complete||0);
  const staleStoredTech=Math.max(0,rawTechPending-storedTechPending);
  counts.TECH_PENDING=storedTechPending+pendingFromComplete;
  counts.COMPLETE=Math.max(0,Number(counts.COMPLETE||0)+staleStoredTech-pendingFromComplete);

  const effectiveTechPending=Number(tech?.pending||0);
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
