import 'server-only';
import {db} from './db';

export const DEFAULT_NEWS_SETTINGS={version:1,movie:{general:{minRating:6,minVotes:10000},spain:{minRating:6,minVotes:7500}},series:{general:{minRating:7,minVotes:5000},spain:{minRating:6.5,minVotes:4000}},excludedCountries:['Q668','IN'],excludeAdult:true};
function mergeSettings(raw={}){return {...DEFAULT_NEWS_SETTINGS,...raw,movie:{general:{...DEFAULT_NEWS_SETTINGS.movie.general,...raw?.movie?.general},spain:{...DEFAULT_NEWS_SETTINGS.movie.spain,...raw?.movie?.spain}},series:{general:{...DEFAULT_NEWS_SETTINGS.series.general,...raw?.series?.general},spain:{...DEFAULT_NEWS_SETTINGS.series.spain,...raw?.series?.spain}},excludedCountries:Array.isArray(raw?.excludedCountries)?raw.excludedCountries:DEFAULT_NEWS_SETTINGS.excludedCountries}}
export async function getNewsSettings(){const sql=db();const [row]=await sql`SELECT value,updated_at FROM app_settings WHERE key='imdb_discovery_v1' LIMIT 1`;return {...mergeSettings(row?.value||{}),updatedAt:row?.updated_at||null}}

function deriveOrigin(row){if(row.row_kind==='plex_unidentified')return 'plex';const s=row.source_snapshot||{};if(s.manual===true||s.manual==='true'||row.matched_rule==='manual')return 'manual';if(s.origin==='plex'||row.matched_rule==='plex')return 'plex';return 'discovery'}
function deriveState(row){if(row.row_kind==='plex_unidentified')return 'identity_pending';const s=row.source_snapshot||{};if(s.authoritativeStatus==='failed')return 'error';if(row.eligibility_status==='processing')return 'preparing';if(deriveOrigin(row)==='plex'&&row.eligibility_status!=='eligible')return 'preparing';if((s.authoritativeStatus==='pending'||s.authoritativeRequestedAt)&&row.imdb_rating==null&&row.imdb_votes==null)return 'preparing';return 'eligible'}

export async function getNewsV1(filters={}){
  const sql=db(),type=String(filters.type||'all'),sort=String(filters.sort||'new'),q=String(filters.q||'').trim().toLowerCase(),source=String(filters.source||'all'),state=String(filters.state||'all');
  const allowedSizes=[24,48,96],pageSize=allowedSizes.includes(Number(filters.pageSize))?Number(filters.pageSize):24,page=Math.max(1,Number(filters.page)||1),offset=(page-1)*pageSize;

  const candidateRows=await sql`
    SELECT 'candidate'::text row_kind,c.imdb_id,NULL::text rating_key,c.candidate_type,c.year,c.imdb_rating,c.imdb_votes,c.first_seen_at,c.became_eligible_at,c.last_seen_at,c.eligibility_status,c.source_snapshot,
      COALESCE(c.source_snapshot->>'title',c.source_snapshot->>'originalTitle',c.imdb_id) title,
      COALESCE(c.source_snapshot->>'originalTitle',c.source_snapshot->>'title') original_title,
      COALESCE(c.source_snapshot->>'matchedRule',CASE WHEN c.source_snapshot->>'origin'='plex' THEN 'plex' WHEN c.source_snapshot->>'manual'='true' THEN 'manual' ELSE 'general' END) matched_rule,
      COALESCE(c.source_snapshot->>'countryStatus','unknown') country_status,COALESCE(c.source_snapshot->'countries','[]'::jsonb) countries
    FROM catalog_candidates c
    LEFT JOIN movies m ON m.imdb_id=c.imdb_id
    LEFT JOIN catalog_exclusions ex ON ex.imdb_id=c.imdb_id
    WHERE m.imdb_id IS NULL AND ex.imdb_id IS NULL
      AND (c.eligibility_status IN('eligible','processing') OR (c.source_snapshot->>'manual'='true' AND COALESCE(c.source_snapshot->>'manualActive','true')='true'))`;

  const plexPending=await sql`
    SELECT 'plex_unidentified'::text row_kind,NULL::text imdb_id,p.rating_key,
      CASE WHEN p.item_type='movie' THEN 'movie' ELSE 'tvSeries' END candidate_type,
      p.plex_year year,NULL::numeric imdb_rating,NULL::bigint imdb_votes,p.added_at first_seen_at,NULL::timestamptz became_eligible_at,p.updated_at last_seen_at,
      'processing'::text eligibility_status,
      jsonb_build_object('origin','plex','matchedRule','plex','title',p.plex_title,'plexRatingKey',p.rating_key,'identityPending',true) source_snapshot,
      COALESCE(NULLIF(p.plex_title,''),p.rating_key) title,p.plex_title original_title,'plex'::text matched_rule,'unknown'::text country_status,'[]'::jsonb countries
    FROM plex_items p
    LEFT JOIN plex_external_ids imdb ON imdb.rating_key=p.rating_key AND imdb.provider='imdb'
    WHERE p.active AND p.item_type IN('movie','show') AND imdb.external_id IS NULL`;

  let all=[...candidateRows,...plexPending].map(r=>({...r,origin:deriveOrigin(r),news_state:deriveState(r)}));
  if(type==='movie')all=all.filter(r=>r.candidate_type==='movie');
  if(type==='series')all=all.filter(r=>['tvSeries','tvMiniSeries'].includes(r.candidate_type));
  if(q)all=all.filter(r=>String(r.title||r.imdb_id||r.rating_key||'').toLowerCase().includes(q));
  if(['manual','plex','discovery'].includes(source))all=all.filter(r=>r.origin===source);
  if(['identity_pending','preparing','eligible','error'].includes(state))all=all.filter(r=>r.news_state===state);
  all.sort((a,b)=>{
    if(sort==='rating')return (Number(b.imdb_rating)||-1)-(Number(a.imdb_rating)||-1);
    if(sort==='votes')return (Number(b.imdb_votes)||-1)-(Number(a.imdb_votes)||-1);
    if(sort==='year')return (Number(b.year)||0)-(Number(a.year)||0);
    return new Date(b.became_eligible_at||b.first_seen_at||0)-new Date(a.became_eligible_at||a.first_seen_at||0);
  });
  const rows=all.slice(offset,offset+pageSize);

  const raw=[...candidateRows,...plexPending].map(r=>({...r,origin:deriveOrigin(r),news_state:deriveState(r)}));
  const stats={
    total:raw.length,
    movies:raw.filter(r=>r.candidate_type==='movie').length,
    series:raw.filter(r=>['tvSeries','tvMiniSeries'].includes(r.candidate_type)).length,
    spanish_rescues:raw.filter(r=>r.matched_rule==='spain').length,
    manual:raw.filter(r=>r.origin==='manual').length,
    plex:raw.filter(r=>r.origin==='plex').length,
    discovery:raw.filter(r=>r.origin==='discovery').length,
    identity_pending:raw.filter(r=>r.news_state==='identity_pending').length,
    preparing:raw.filter(r=>r.news_state==='preparing').length,
    eligible:raw.filter(r=>r.news_state==='eligible').length,
    error:raw.filter(r=>r.news_state==='error').length
  };

  const [excludedStats]=await sql`SELECT count(*)::int total FROM catalog_exclusions`;
  const [latestRun]=await sql`SELECT id,status,started_at,finished_at,processed_count,added_count,updated_count,error_count,summary FROM pipeline_runs WHERE job_type='imdb_discovery' ORDER BY started_at DESC LIMIT 1`;
  const [lastSuccess]=await sql`SELECT id,started_at,finished_at FROM pipeline_runs WHERE job_type='imdb_discovery' AND status='success' ORDER BY COALESCE(finished_at,started_at) DESC LIMIT 1`;
  const [overrideRow]=await sql`SELECT value,updated_at FROM app_settings WHERE key='imdb_discovery_test_override' LIMIT 1`;
  const overrideValue=overrideRow?.value||{},testOverrideAvailable=overrideValue.enabled===true&&overrideValue.used!==true;
  const nextAllowedAt=lastSuccess?new Date(new Date(lastSuccess.finished_at||lastSuccess.started_at).getTime()+7*24*60*60*1000):null;
  const discoveryAllowed=!nextAllowedAt||nextAllowedAt<=new Date();
  return {rows,stats,filteredTotal:all.length,excludedCount:excludedStats?.total||0,latestRun:latestRun||null,lastSuccess:lastSuccess||null,nextAllowedAt,discoveryAllowed,testOverrideAvailable,testOverrideUpdatedAt:overrideRow?.updated_at||null,page,pageSize};
}

export async function getNewsCandidate(imdbId){const sql=db();const [r]=await sql`SELECT c.*,COALESCE(c.source_snapshot->>'title',c.source_snapshot->>'originalTitle',c.imdb_id) title,COALESCE(c.source_snapshot->>'matchedRule',CASE WHEN c.source_snapshot->>'origin'='plex' THEN 'plex' WHEN c.source_snapshot->>'manual'='true' THEN 'manual' ELSE 'general' END) matched_rule FROM catalog_candidates c LEFT JOIN movies m ON m.imdb_id=c.imdb_id LEFT JOIN catalog_exclusions ex ON ex.imdb_id=c.imdb_id WHERE c.imdb_id=${imdbId} AND m.imdb_id IS NULL AND ex.imdb_id IS NULL LIMIT 1`;return r||null}
