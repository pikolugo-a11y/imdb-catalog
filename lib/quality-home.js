import 'server-only';
import {db} from './db';
import {LIFECYCLE} from './lifecycle';
import {buildQualityHome} from './quality-home-domain.mjs';
import {getIdentityWorkflowStats} from './identity-page';
import {getIdentityValidationStats} from './identity-validation-page';
import {getDataQualityOverview} from './data-quality-page';
import {getMovieQualitySummary} from './movie-quality-dashboard';
import {getSeriesQualityCounts} from './series-quality-query';
import {getPikoQualityState} from './pikoquality-state';
import {getPeopleQualitySummary} from './people-quality';

export async function getQualityHomeSnapshot(){
  const sql=db();
  const [stateRows,[meta],identity,validation,data,movies,series,pikoquality,people]=await Promise.all([
    sql`SELECT lifecycle_state,count(*)::int count FROM catalog_lifecycle GROUP BY lifecycle_state`,
    sql`SELECT
      (SELECT count(*)::int FROM movies) total,
      (SELECT count(*)::int FROM movies m LEFT JOIN catalog_lifecycle cl USING(imdb_id) LEFT JOIN catalog_exclusions ex USING(imdb_id) WHERE cl.imdb_id IS NULL AND ex.imdb_id IS NULL) missing,
      (SELECT count(*)::int FROM catalog_lifecycle cl LEFT JOIN movies m USING(imdb_id) WHERE m.imdb_id IS NULL) orphaned,
      (SELECT count(*)::int FROM catalog_lifecycle cl JOIN movies m USING(imdb_id) WHERE (m.type IN ('Serie','Miniserie') AND cl.lifecycle_state IN ('MOVIE_FILE_PENDING','MOVIE_FILE_REVIEW')) OR (m.type='Película' AND cl.lifecycle_state IN ('SERIES_SYNC_PENDING','SERIES_REVIEW'))) incompatible`,
    getIdentityWorkflowStats(),getIdentityValidationStats(),getDataQualityOverview(sql),getMovieQualitySummary(sql),getSeriesQualityCounts(sql),getPikoQualityState(),getPeopleQualitySummary()
  ]);
  const counts={};let unknown=0;
  for(const row of stateRows){counts[row.lifecycle_state]=Number(row.count||0);if(!LIFECYCLE[row.lifecycle_state])unknown+=Number(row.count||0);}
  const materialized=Object.values(counts).reduce((a,b)=>a+Number(b||0),0);
  const stageCounts={recovery:Number(meta?.missing||0),identity:Number(identity?.affected_catalog||0),validation:Number(validation?.total||0),data:Number(data?.incomplete||0)+Number(data?.ratingsPending||0)+Number(data?.scoreReady||0),movies:Number(movies?.affected||0),series:Number(series?.attention||0),pikoquality:Number(pikoquality?.pending_a||0),people:Number(people?.pending||0)};
  return buildQualityHome({total:Number(meta?.total||0),materialized,missing:Number(meta?.missing||0),counts,stageCounts,integrity:{orphaned:Number(meta?.orphaned||0),unknown,incompatible:Number(meta?.incompatible||0)}});
}
