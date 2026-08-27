import 'server-only';
import {db} from './db';
import {getQualityHomeSnapshot} from './quality-home';

const clamp=(n,min=0,max=100)=>Math.max(min,Math.min(max,Number(n)||0));
const pct=(a,b)=>b?Number((Number(a||0)/Number(b)*100).toFixed(1)):0;

export async function getDashboardV2(period='30'){
  const sql=db(),days=Math.max(7,Math.min(3650,Number(period)||30));
  const [
    [kpi],decades,genres,countries,history,[saga],[profile],scoreBands,quality
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
    sql`SELECT g.name_es label,count(*)::int total,
      count(*) FILTER(WHERE c.effective_status='in_plex')::int owned,
      round(avg(m.final_rating) FILTER(WHERE m.final_rating>0)::numeric,2) avg_score
    FROM movie_genres_canonical mg JOIN genres g ON g.id=mg.genre_id JOIN movies m ON m.imdb_id=mg.imdb_id
    LEFT JOIN catalog_exclusions e ON e.imdb_id=mg.imdb_id LEFT JOIN catalog_read_model c ON c.imdb_id=mg.imdb_id
    WHERE e.imdb_id IS NULL GROUP BY g.name_es ORDER BY total DESC LIMIT 12`,
    sql`SELECT ctry.name_es label,count(*)::int total,
      count(*) FILTER(WHERE crm.effective_status='in_plex')::int owned,
      round(avg(m.final_rating) FILTER(WHERE m.final_rating>0)::numeric,2) avg_score
    FROM movie_countries mc JOIN countries ctry ON ctry.code=mc.country_code JOIN movies m ON m.imdb_id=mc.imdb_id
    LEFT JOIN catalog_exclusions e ON e.imdb_id=mc.imdb_id LEFT JOIN catalog_read_model crm ON crm.imdb_id=mc.imdb_id
    WHERE e.imdb_id IS NULL GROUP BY ctry.name_es ORDER BY total DESC LIMIT 12`,
    sql`SELECT snapshot_date,metrics FROM dashboard_snapshots WHERE snapshot_date>=current_date-${days}::int ORDER BY snapshot_date`,
    sql`SELECT count(*) FILTER(WHERE owned>0 AND missing>0)::int incomplete,
      count(*) FILTER(WHERE owned>0 AND missing=1)::int one_missing,
      count(*) FILTER(WHERE total>0 AND missing=0)::int complete,
      count(*) FILTER(WHERE total>0)::int total_sagas,
      sum(total)::int saga_titles,
      sum(owned)::int saga_owned
    FROM (
      SELECT sc.tmdb_collection_id,count(sm.*)::int total,
        count(sm.*) FILTER(WHERE c.effective_status='in_plex')::int owned,
        count(sm.*) FILTER(WHERE c.effective_status IS DISTINCT FROM 'in_plex')::int missing
      FROM saga_collections sc LEFT JOIN saga_collection_members sm USING(tmdb_collection_id)
      LEFT JOIN catalog_exclusions ex ON ex.imdb_id=sm.imdb_id LEFT JOIN catalog_read_model c ON c.imdb_id=sm.imdb_id
      WHERE ex.imdb_id IS NULL GROUP BY sc.tmdb_collection_id
    )x`,
    sql`SELECT
      min(m.year)::int oldest_year,
      percentile_cont(0.5) WITHIN GROUP(ORDER BY m.year) FILTER(WHERE m.year IS NOT NULL)::numeric median_year,
      percentile_cont(0.5) WITHIN GROUP(ORDER BY m.runtime) FILTER(WHERE m.type='Película' AND m.runtime>0)::numeric median_runtime,
      count(*) FILTER(WHERE m.type='Película')::int movie_total,
      count(*) FILTER(WHERE m.type='Película' AND m.runtime>0)::int movie_runtime_known,
      count(*) FILTER(WHERE m.type='Película' AND m.runtime<90 AND m.runtime>0)::int under_90,
      count(*) FILTER(WHERE m.type='Película' AND m.runtime>=180)::int over_180,
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
    getQualityHomeSnapshot()
  ]);

  const coverage=pct(kpi.in_plex,kpi.catalog_total);
  const qualityScore=clamp(quality?.progressPct);
  const anomalies=Number(quality?.integrity?.total||0);
  const integrityScore=clamp(100-pct(anomalies,Math.max(Number(quality?.activeTotal||0),1)));
  // Cobertura de catálogo es descriptiva: no empuja el Pulse hacia un objetivo artificial del 100%.
  const pulse=Number((qualityScore*.7+integrityScore*.3).toFixed(1));
  const sagaCoverage=pct(saga?.saga_owned,saga?.saga_titles);
  const sagaComplete=pct(saga?.complete,saga?.total_sagas);
  const runtimeCoverage=pct(profile?.movie_runtime_known,profile?.movie_total);
  const scoreCoverage=pct(kpi.score_known,kpi.catalog_total);

  const decorate=rows=>rows.map(r=>({...r,total:Number(r.total||0),owned:Number(r.owned||0),coverage:pct(r.owned,r.total),avg_score:r.avg_score==null?null:Number(r.avg_score)}));
  const decoratedGenres=decorate(genres),decoratedCountries=decorate(countries),decoratedDecades=decades.map(r=>({...r,total:Number(r.total||0),owned:Number(r.owned||0),coverage:pct(r.owned,r.total),avg_score:r.avg_score==null?null:Number(r.avg_score)}));

  const balance={
    genres:decoratedGenres.map(r=>({...r,target_share:pct(r.total,kpi.catalog_total),plex_share:pct(r.owned,kpi.in_plex)})).map(r=>({...r,delta:Number((r.plex_share-r.target_share).toFixed(1))})),
    decades:decoratedDecades.map(r=>({...r,target_share:pct(r.total,kpi.catalog_total),plex_share:pct(r.owned,kpi.in_plex)})).map(r=>({...r,delta:Number((r.plex_share-r.target_share).toFixed(1))}))
  };

  return{
    kpi:{...kpi,coverage,plex_outside:Number(kpi.plex_outside||0)},
    pulse:{score:pulse,quality:qualityScore,integrity:integrityScore,catalog:coverage},
    quality,
    decades:decoratedDecades,
    genres:decoratedGenres,
    countries:decoratedCountries,
    history,
    sagas:{...saga,coverage:sagaCoverage,complete_pct:sagaComplete},
    profile:{...profile,runtime_coverage:runtimeCoverage,score_coverage:scoreCoverage},
    scoreBands:scoreBands.map(r=>({...r,total:Number(r.total||0),owned:Number(r.owned||0),coverage:pct(r.owned,r.total)})),
    balance,
    days
  };
}

export async function captureDashboardSnapshot(){
  const sql=db();
  const d=await getDashboardV2('30');
  const metrics={
    catalog_total:Number(d.kpi.catalog_total||0),in_plex:Number(d.kpi.in_plex||0),missing:Number(d.kpi.missing||0),coverage:Number(d.kpi.coverage||0),
    pulse:Number(d.pulse.score||0),pulse_quality:Number(d.pulse.quality||0),pulse_integrity:Number(d.pulse.integrity||0),
    quality_progress:Number(d.quality?.progressPct||0),sagas_complete:Number(d.sagas?.complete||0),sagas_total:Number(d.sagas?.total_sagas||0)
  };
  await sql`INSERT INTO dashboard_snapshots(snapshot_date,metrics,created_at) VALUES(current_date,${JSON.stringify(metrics)}::jsonb,now()) ON CONFLICT(snapshot_date) DO UPDATE SET metrics=EXCLUDED.metrics,created_at=now()`;
  return metrics;
}
