import 'server-only';
import {db} from './db';
import {getQualityHomeSnapshot} from './quality-home';
import {getSagasDashboard} from './sagas-v3';

const SNAPSHOT_SCHEMA_VERSION=2;
const clamp=(n,min=0,max=100)=>Math.max(min,Math.min(max,Number(n)||0));
const pct=(a,b)=>b?Number((Number(a||0)/Number(b)*100).toFixed(1)):0;
const toNumber=v=>v==null?null:Number(v);

export async function getDashboardV2(period='30'){
  const sql=db(),days=Math.max(7,Math.min(3650,Number(period)||30));
  const [
    [kpi],decades,genres,countries,history,profile,scoreBands,quality,sagaData
  ]=await Promise.all([
    sql`SELECT
      count(*)::int catalog_total,
      count(*) FILTER(WHERE m.type='Película')::int movies,
      count(*) FILTER(WHERE m.type IN('Serie','Miniserie'))::int series,
      count(*) FILTER(WHERE c.effective_status='in_plex')::int in_plex,
      count(*) FILTER(WHERE c.effective_status IS DISTINCT FROM 'in_plex')::int missing,
      count(*) FILTER(WHERE m.final_rating IS NOT NULL AND m.final_rating>0)::int score_known,
      round(avg(m.final_rating) FILTER(WHERE m.final_rating IS NOT NULL AND m.final_rating>0)::numeric,2) avg_score,
      round(avg(m.final_rating) FILTER(WHERE c.effective_status='in_plex' AND m.final_rating IS NOT NULL AND m.final_rating>0)::numeric,2) avg_score_plex,
      (SELECT count(*)::int FROM catalog_exclusions) excluded,
      (SELECT count(*)::int FROM plex_not_in_catalog) plex_outside,
      (SELECT max(finished_at) FROM plex_sync_runs WHERE status='success') last_plex_sync
    FROM movies m
    LEFT JOIN catalog_exclusions e USING(imdb_id)
    LEFT JOIN catalog_read_model c USING(imdb_id)
    WHERE e.imdb_id IS NULL`,
    sql`SELECT (floor(m.year/10)*10)::int bucket,count(*)::int total,
      count(*) FILTER(WHERE c.effective_status='in_plex')::int owned,
      round(avg(m.final_rating) FILTER(WHERE m.final_rating>0)::numeric,2) avg_score
    FROM movies m LEFT JOIN catalog_exclusions e USING(imdb_id) LEFT JOIN catalog_read_model c USING(imdb_id)
    WHERE e.imdb_id IS NULL AND m.year IS NOT NULL GROUP BY 1 ORDER BY 1`,
    sql`WITH assoc AS (
      SELECT mg.imdb_id,g.name_es label,c.effective_status,m.final_rating,
        count(*) OVER(PARTITION BY mg.imdb_id) assoc_count
      FROM movie_genres_canonical mg
      JOIN genres g ON g.id=mg.genre_id
      JOIN movies m ON m.imdb_id=mg.imdb_id
      LEFT JOIN catalog_exclusions e ON e.imdb_id=mg.imdb_id
      LEFT JOIN catalog_read_model c ON c.imdb_id=mg.imdb_id
      WHERE e.imdb_id IS NULL
    ), grouped AS (
      SELECT label,count(*)::int total,
        count(*) FILTER(WHERE effective_status='in_plex')::int owned,
        round(avg(final_rating) FILTER(WHERE final_rating>0)::numeric,2) avg_score,
        sum(1.0/assoc_count)::numeric fractional_total,
        sum(1.0/assoc_count) FILTER(WHERE effective_status='in_plex')::numeric fractional_owned
      FROM assoc GROUP BY label
    )
    SELECT *,sum(fractional_total) OVER() fractional_total_all,
      sum(fractional_owned) OVER() fractional_owned_all
    FROM grouped ORDER BY total DESC LIMIT 12`,
    sql`WITH assoc AS (
      SELECT mc.imdb_id,ctry.name_es label,crm.effective_status,m.final_rating,
        count(*) OVER(PARTITION BY mc.imdb_id) assoc_count
      FROM movie_countries mc
      JOIN countries ctry ON ctry.code=mc.country_code
      JOIN movies m ON m.imdb_id=mc.imdb_id
      LEFT JOIN catalog_exclusions e ON e.imdb_id=mc.imdb_id
      LEFT JOIN catalog_read_model crm ON crm.imdb_id=mc.imdb_id
      WHERE e.imdb_id IS NULL
    ), grouped AS (
      SELECT label,count(*)::int total,
        count(*) FILTER(WHERE effective_status='in_plex')::int owned,
        round(avg(final_rating) FILTER(WHERE final_rating>0)::numeric,2) avg_score,
        sum(1.0/assoc_count)::numeric fractional_total,
        sum(1.0/assoc_count) FILTER(WHERE effective_status='in_plex')::numeric fractional_owned
      FROM assoc GROUP BY label
    )
    SELECT *,sum(fractional_total) OVER() fractional_total_all,
      sum(fractional_owned) OVER() fractional_owned_all
    FROM grouped ORDER BY total DESC LIMIT 12`,
    sql`SELECT snapshot_date,metrics FROM dashboard_snapshots WHERE snapshot_date>=current_date-${days}::int ORDER BY snapshot_date`,
    sql`SELECT
      min(m.year)::int oldest_year,
      max(m.year)::int newest_year,
      percentile_cont(0.5) WITHIN GROUP(ORDER BY m.year) FILTER(WHERE m.year IS NOT NULL)::numeric median_year,
      percentile_cont(0.5) WITHIN GROUP(ORDER BY m.runtime) FILTER(WHERE m.type='Película' AND m.runtime>0)::numeric median_runtime,
      count(*) FILTER(WHERE m.type='Película')::int movie_total,
      count(*) FILTER(WHERE m.type='Película' AND m.runtime>0)::int movie_runtime_known,
      count(*) FILTER(WHERE m.type='Película' AND m.runtime>0 AND m.runtime<90)::int runtime_lt90,
      count(*) FILTER(WHERE m.type='Película' AND m.runtime>=90 AND m.runtime<120)::int runtime_90_119,
      count(*) FILTER(WHERE m.type='Película' AND m.runtime>=120 AND m.runtime<150)::int runtime_120_149,
      count(*) FILTER(WHERE m.type='Película' AND m.runtime>=150 AND m.runtime<180)::int runtime_150_179,
      count(*) FILTER(WHERE m.type='Película' AND m.runtime>=180)::int runtime_180_plus,
      round((sum(m.runtime) FILTER(WHERE m.type='Película' AND c.effective_status='in_plex' AND m.runtime>0)/60.0)::numeric,0) plex_movie_hours,
      percentile_cont(0.5) WITHIN GROUP(ORDER BY m.final_rating) FILTER(WHERE m.final_rating>0)::numeric median_score
    FROM movies m LEFT JOIN catalog_exclusions e USING(imdb_id) LEFT JOIN catalog_read_model c USING(imdb_id)
    WHERE e.imdb_id IS NULL`,
    sql`SELECT band,count(*)::int total,count(*) FILTER(WHERE effective_status='in_plex')::int owned FROM (
      SELECT CASE WHEN m.final_rating>=9 THEN '9+' WHEN m.final_rating>=8 THEN '8–8,9' WHEN m.final_rating>=7 THEN '7–7,9' WHEN m.final_rating>=6 THEN '6–6,9' ELSE '<6' END band,
        c.effective_status
      FROM movies m LEFT JOIN catalog_exclusions e USING(imdb_id) LEFT JOIN catalog_read_model c USING(imdb_id)
      WHERE e.imdb_id IS NULL AND m.final_rating IS NOT NULL AND m.final_rating>0
    )x GROUP BY band ORDER BY CASE band WHEN '9+' THEN 1 WHEN '8–8,9' THEN 2 WHEN '7–7,9' THEN 3 WHEN '6–6,9' THEN 4 ELSE 5 END`,
    getQualityHomeSnapshot(),
    getSagasDashboard({page:1,pageSize:24,state:'all',sort:'easy'})
  ]);

  const coverage=pct(kpi.in_plex,kpi.catalog_total);
  const qualityScore=clamp(quality?.progressPct);
  const anomalies=Number(quality?.integrity?.total||0);
  const integrityBase=Math.max(Number(quality?.activeTotal||0),1);
  const integrityScore=clamp(100-pct(anomalies,integrityBase));
  const pulse=Number((qualityScore*.7+integrityScore*.3).toFixed(1));
  const sagaStats=sagaData?.stats||{};
  const sagaCoverage=pct(sagaStats.owned_movies,sagaStats.movies);
  const sagaComplete=pct(sagaStats.complete,sagaStats.all);
  const runtimeCoverage=pct(profile?.movie_runtime_known,profile?.movie_total);
  const scoreCoverage=pct(kpi.score_known,kpi.catalog_total);

  const decorate=rows=>rows.map(r=>({...r,total:Number(r.total||0),owned:Number(r.owned||0),coverage:pct(r.owned,r.total),avg_score:r.avg_score==null?null:Number(r.avg_score),fractional_total:toNumber(r.fractional_total),fractional_owned:toNumber(r.fractional_owned),fractional_total_all:toNumber(r.fractional_total_all),fractional_owned_all:toNumber(r.fractional_owned_all)}));
  const decoratedGenres=decorate(genres),decoratedCountries=decorate(countries),decoratedDecades=decades.map(r=>({...r,total:Number(r.total||0),owned:Number(r.owned||0),coverage:pct(r.owned,r.total),avg_score:r.avg_score==null?null:Number(r.avg_score)}));

  const makeFractionalBalance=rows=>rows.map(r=>{
    const targetShare=pct(r.fractional_total,r.fractional_total_all);
    const plexShare=pct(r.fractional_owned,r.fractional_owned_all);
    return{...r,target_share:targetShare,plex_share:plexShare,delta:Number((plexShare-targetShare).toFixed(1))};
  });
  const balance={
    genres:makeFractionalBalance(decoratedGenres),
    countries:makeFractionalBalance(decoratedCountries),
    decades:decoratedDecades.map(r=>({...r,target_share:pct(r.total,kpi.catalog_total),plex_share:pct(r.owned,kpi.in_plex)})).map(r=>({...r,delta:Number((r.plex_share-r.target_share).toFixed(1))}))
  };

  return{
    kpi:{...kpi,coverage,plex_outside:Number(kpi.plex_outside||0)},
    pulse:{score:pulse,quality:qualityScore,integrity:integrityScore,integrity_anomalies:anomalies},
    quality,
    decades:decoratedDecades,
    genres:decoratedGenres,
    countries:decoratedCountries,
    history,
    sagas:{...sagaStats,coverage:sagaCoverage,complete_pct:sagaComplete},
    profile:{...profile,runtime_coverage:runtimeCoverage,score_coverage:scoreCoverage},
    scoreBands:scoreBands.map(r=>({label:r.band,band:r.band,total:Number(r.total||0),owned:Number(r.owned||0),coverage:pct(r.owned,r.total)})),
    balance,
    days,
    snapshotSchemaVersion:SNAPSHOT_SCHEMA_VERSION
  };
}

export async function captureDashboardSnapshot(){
  const sql=db();
  const d=await getDashboardV2('30');
  const metrics={
    schema_version:SNAPSHOT_SCHEMA_VERSION,
    catalog_total:Number(d.kpi.catalog_total||0),
    in_plex:Number(d.kpi.in_plex||0),
    missing:Number(d.kpi.missing||0),
    coverage:Number(d.kpi.coverage||0),
    pulse:Number(d.pulse.score||0),
    pulse_quality:d.pulse.quality==null?null:Number(d.pulse.quality),
    pulse_integrity:d.pulse.integrity==null?null:Number(d.pulse.integrity),
    quality_progress:d.quality?.progressPct==null?null:Number(d.quality.progressPct),
    sagas_complete:Number(d.sagas?.complete||0),
    sagas_total:Number(d.sagas?.all||0)
  };
  await sql`INSERT INTO dashboard_snapshots(snapshot_date,metrics,created_at) VALUES(current_date,${JSON.stringify(metrics)}::jsonb,now()) ON CONFLICT(snapshot_date) DO UPDATE SET metrics=EXCLUDED.metrics,created_at=now()`;
  return metrics;
}
