import 'server-only';
import {db} from './db';

export const DEFAULT_NEWS_SETTINGS={version:1,movie:{general:{minRating:6,minVotes:10000},spain:{minRating:6,minVotes:7500}},series:{general:{minRating:7,minVotes:5000},spain:{minRating:6.5,minVotes:4000}},excludedCountries:['Q668','IN'],excludeAdult:true};
function mergeSettings(raw={}){return {...DEFAULT_NEWS_SETTINGS,...raw,movie:{general:{...DEFAULT_NEWS_SETTINGS.movie.general,...raw?.movie?.general},spain:{...DEFAULT_NEWS_SETTINGS.movie.spain,...raw?.movie?.spain}},series:{general:{...DEFAULT_NEWS_SETTINGS.series.general,...raw?.series?.general},spain:{...DEFAULT_NEWS_SETTINGS.series.spain,...raw?.series?.spain}},excludedCountries:Array.isArray(raw?.excludedCountries)?raw.excludedCountries:DEFAULT_NEWS_SETTINGS.excludedCountries}}
export async function getNewsSettings(){const sql=db();const [row]=await sql`SELECT value,updated_at FROM app_settings WHERE key='imdb_discovery_v1' LIMIT 1`;return {...mergeSettings(row?.value||{}),updatedAt:row?.updated_at||null}}

export async function getNewsV1(filters={}){
  const sql=db(),type=String(filters.type||'all'),sort=String(filters.sort||'new'),q=String(filters.q||'').trim().toLowerCase();
  const allowedSizes=[24,48,96],pageSize=allowedSizes.includes(Number(filters.pageSize))?Number(filters.pageSize):24,page=Math.max(1,Number(filters.page)||1),offset=(page-1)*pageSize,typePredicate=type==='movie'?'movie':type==='series'?'series':null;
  const rows=await sql`
    SELECT c.imdb_id,c.candidate_type,c.year,c.imdb_rating,c.imdb_votes,c.first_seen_at,c.became_eligible_at,c.last_seen_at,c.eligibility_status,c.source_snapshot,
      COALESCE(c.source_snapshot->>'title',c.source_snapshot->>'originalTitle',c.imdb_id) title,
      COALESCE(c.source_snapshot->>'originalTitle',c.source_snapshot->>'title') original_title,
      COALESCE(c.source_snapshot->>'matchedRule',CASE WHEN c.source_snapshot->>'manual'='true' THEN 'manual' ELSE 'general' END) matched_rule,
      COALESCE(c.source_snapshot->>'countryStatus','unknown') country_status,COALESCE(c.source_snapshot->'countries','[]'::jsonb) countries
    FROM catalog_candidates c LEFT JOIN movies m ON m.imdb_id=c.imdb_id LEFT JOIN catalog_exclusions ex ON ex.imdb_id=c.imdb_id
    WHERE m.imdb_id IS NULL AND ex.imdb_id IS NULL AND (c.eligibility_status IN('eligible','processing') OR (c.source_snapshot->>'manual'='true' AND COALESCE(c.source_snapshot->>'manualActive','true')='true'))
      AND (${typePredicate}::text IS NULL OR (${typePredicate}='movie' AND c.candidate_type='movie') OR (${typePredicate}='series' AND c.candidate_type IN('tvSeries','tvMiniSeries')))
      AND (${q}='' OR lower(COALESCE(c.source_snapshot->>'title',c.source_snapshot->>'originalTitle',c.imdb_id)) LIKE ${'%'+q+'%'})
    ORDER BY CASE WHEN ${sort}='rating' THEN c.imdb_rating END DESC NULLS LAST,CASE WHEN ${sort}='votes' THEN c.imdb_votes END DESC NULLS LAST,CASE WHEN ${sort}='year' THEN c.year END DESC NULLS LAST,CASE WHEN ${sort}='new' THEN COALESCE(c.became_eligible_at,c.first_seen_at) END DESC NULLS LAST,c.imdb_id LIMIT ${pageSize} OFFSET ${offset}`;
  const [stats]=await sql`SELECT count(*)::int total,count(*) FILTER(WHERE c.candidate_type='movie')::int movies,count(*) FILTER(WHERE c.candidate_type IN('tvSeries','tvMiniSeries'))::int series,count(*) FILTER(WHERE c.source_snapshot->>'matchedRule'='spain')::int spanish_rescues,count(*) FILTER(WHERE c.source_snapshot->>'manual'='true' AND COALESCE(c.source_snapshot->>'manualActive','true')='true')::int manual FROM catalog_candidates c LEFT JOIN movies m ON m.imdb_id=c.imdb_id LEFT JOIN catalog_exclusions ex ON ex.imdb_id=c.imdb_id WHERE m.imdb_id IS NULL AND ex.imdb_id IS NULL AND (c.eligibility_status IN('eligible','processing') OR (c.source_snapshot->>'manual'='true' AND COALESCE(c.source_snapshot->>'manualActive','true')='true'))`;
  const [excludedStats]=await sql`SELECT count(*)::int total FROM catalog_exclusions`;
  const [latestRun]=await sql`SELECT id,status,started_at,finished_at,processed_count,added_count,updated_count,error_count,summary FROM pipeline_runs WHERE job_type='imdb_discovery' ORDER BY started_at DESC LIMIT 1`;
  const [lastSuccess]=await sql`SELECT id,started_at,finished_at FROM pipeline_runs WHERE job_type='imdb_discovery' AND status='success' ORDER BY COALESCE(finished_at,started_at) DESC LIMIT 1`;
  const nextAllowedAt=lastSuccess?new Date(new Date(lastSuccess.finished_at||lastSuccess.started_at).getTime()+7*24*60*60*1000):null;
  const discoveryAllowed=!nextAllowedAt||nextAllowedAt<=new Date();
  return {rows,stats:stats||{total:0,movies:0,series:0,spanish_rescues:0,manual:0},excludedCount:excludedStats?.total||0,latestRun:latestRun||null,lastSuccess:lastSuccess||null,nextAllowedAt,discoveryAllowed,page,pageSize};
}

export async function getNewsCandidate(imdbId){const sql=db();const [r]=await sql`SELECT c.*,COALESCE(c.source_snapshot->>'title',c.source_snapshot->>'originalTitle',c.imdb_id) title,COALESCE(c.source_snapshot->>'matchedRule',CASE WHEN c.source_snapshot->>'manual'='true' THEN 'manual' ELSE 'general' END) matched_rule FROM catalog_candidates c LEFT JOIN movies m ON m.imdb_id=c.imdb_id LEFT JOIN catalog_exclusions ex ON ex.imdb_id=c.imdb_id WHERE c.imdb_id=${imdbId} AND m.imdb_id IS NULL AND ex.imdb_id IS NULL LIMIT 1`;return r||null}
