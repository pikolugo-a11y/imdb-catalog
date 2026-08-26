import 'server-only';
import {db} from './db';
import {assessDataQuality} from './data-quality';
import {PIKOSCORE_V3_VERSION} from './pikoscore-v3-core.mjs';

const PAGE_SIZE=40;
const STAGES=`'DATA_INCOMPLETE','PIKOSCORE_PENDING','MOVIE_FILE_PENDING','MOVIE_FILE_REVIEW','SERIES_SYNC_PENDING','SERIES_REVIEW','TECH_PENDING','COMPLETE'`;
const VERSION=String(PIKOSCORE_V3_VERSION).replace(/'/g,"''");
const TYPES=new Set(['all','Película','Serie']);
const PLEX=new Set(['all','in','out']);
const STATES=new Set(['all','data_incomplete','ratings_pending','score_ready','resolved']);
const COMPLETION=new Set(['all','improvable','complete']);
const SORTS=new Set(['priority','title','coverage','updated']);
const one=v=>Array.isArray(v)?v[0]:v;
const clampPage=n=>Math.max(1,Number.parseInt(n,10)||1);

function parse(filters={}){
  const type=String(one(filters.type)||'all'),plex=String(one(filters.plex)||'all'),state=String(one(filters.state)||'all'),completion=String(one(filters.completion)||'all'),sort=String(one(filters.sort)||'priority');
  return{
    q:String(one(filters.q)||'').trim(),
    type:TYPES.has(type)?type:'all',
    plex:PLEX.has(plex)?plex:'all',
    state:STATES.has(state)?state:'all',
    completion:COMPLETION.has(completion)?completion:'all',
    sort:SORTS.has(sort)?sort:'priority',
    stuck:String(one(filters.stuck)||'')==='1',
    page:clampPage(one(filters.page)),
    pageSize:PAGE_SIZE,
  };
}

const QUALITY_CTE=`WITH genre_flags AS (
  SELECT imdb_id,true AS genres FROM movie_genres GROUP BY imdb_id
), credit_flags AS (
  SELECT imdb_id,
    bool_or(credit_type='cast') AS cast,
    bool_or(credit_type='crew' AND job='Director') AS director
  FROM movie_credits
  WHERE credit_type='cast' OR (credit_type='crew' AND job='Director')
  GROUP BY imdb_id
), base AS (
  SELECT m.imdb_id,m.tmdb_id,m.type,m.title_es,m.original_title,m.year,m.final_rating,m.runtime,m.country,m.poster_path,m.backdrop_path,
    m.ratings_refreshed_at,m.pikoscore_calculated_at,m.pikoscore_version,m.pikoscore_confidence,
    mm.overview,mm.original_language,mm.release_date,cl.lifecycle_state,
    COALESCE(m.ratings_refreshed_at,m.pikoscore_calculated_at) AS lifecycle_updated_at,
    COALESCE(m.source_status #>> '{data_quality_external_poster,url}','') AS external_poster_url,
    COALESCE(m.source_status #>> '{data_quality_external_backdrop,url}','') AS external_backdrop_url,
    COALESCE(m.source_status #>> '{data_quality_external_director,value}','') AS external_director,
    COALESCE(m.source_status #>> '{data_quality_external_cast,value}','') AS external_cast,
    COALESCE(g.genres,false) AS genres,COALESCE(cf.director,false) AS director,COALESCE(cf.cast,false) AS cast,
    (COALESCE(crm.effective_status,'missing')='in_plex') AS in_plex,
    CASE
      WHEN COALESCE(mm.release_date,CASE WHEN m.year BETWEEN 1801 AND 9999 THEN make_date(m.year,1,1) END)>CURRENT_DATE-INTERVAL '3 months' THEN 14
      WHEN COALESCE(mm.release_date,CASE WHEN m.year BETWEEN 1801 AND 9999 THEN make_date(m.year,1,1) END)>CURRENT_DATE-INTERVAL '1 year' THEN 30
      WHEN COALESCE(mm.release_date,CASE WHEN m.year BETWEEN 1801 AND 9999 THEN make_date(m.year,1,1) END)>CURRENT_DATE-INTERVAL '3 years' THEN 90
      WHEN COALESCE(mm.release_date,CASE WHEN m.year BETWEEN 1801 AND 9999 THEN make_date(m.year,1,1) END)>CURRENT_DATE-INTERVAL '10 years' THEN 180
      ELSE 365 END AS fresh_days
  FROM catalog_lifecycle cl
  JOIN movies m USING(imdb_id)
  LEFT JOIN movie_metadata mm USING(imdb_id)
  LEFT JOIN catalog_exclusions ex USING(imdb_id)
  LEFT JOIN catalog_read_model crm ON crm.imdb_id=m.imdb_id
  LEFT JOIN genre_flags g USING(imdb_id)
  LEFT JOIN credit_flags cf USING(imdb_id)
  WHERE ex.imdb_id IS NULL AND cl.lifecycle_state IN (${STAGES})
), ratings AS (
  SELECT tr.imdb_id,
    count(*) FILTER(WHERE tr.status='available' AND COALESCE(tr.normalized_rating,0)>0) AS rating_count,
    count(*) FILTER(WHERE tr.status='available' AND COALESCE(tr.normalized_rating,0)>0 AND COALESCE(tr.expires_at,tr.fetched_at+(b.fresh_days||' days')::interval)>now()) AS fresh_rating_count,
    max(tr.fetched_at) FILTER(WHERE tr.status='available' AND COALESCE(tr.normalized_rating,0)>0) AS latest_rating_fetched_at,
    min(COALESCE(tr.expires_at,tr.fetched_at+(b.fresh_days||' days')::interval)) FILTER(WHERE tr.status='available' AND COALESCE(tr.normalized_rating,0)>0) AS next_rating_refresh_at
  FROM title_ratings tr JOIN base b USING(imdb_id)
  GROUP BY tr.imdb_id
), facts AS (
  SELECT b.*,COALESCE(r.rating_count,0)::int AS rating_count,COALESCE(r.fresh_rating_count,0)::int AS fresh_rating_count,
    r.latest_rating_fetched_at,r.next_rating_refresh_at,
    (NULLIF(b.title_es,'') IS NOT NULL AND NULLIF(b.original_title,'') IS NOT NULL AND b.year>1800 AND NULLIF(b.type,'') IS NOT NULL AND (b.type IN ('Serie','Miniserie') OR COALESCE(b.runtime,0)>0)) AS data_ready,
    ((CASE WHEN NULLIF(b.title_es,'') IS NOT NULL THEN 1 ELSE 0 END)+
     (CASE WHEN NULLIF(b.original_title,'') IS NOT NULL THEN 1 ELSE 0 END)+
     (CASE WHEN b.year>1800 THEN 1 ELSE 0 END)+
     (CASE WHEN NULLIF(b.type,'') IS NOT NULL THEN 1 ELSE 0 END)+
     (CASE WHEN COALESCE(b.runtime,0)>0 THEN 1 ELSE 0 END)+
     (CASE WHEN NULLIF(b.country,'') IS NOT NULL THEN 1 ELSE 0 END)+
     (CASE WHEN b.genres THEN 1 ELSE 0 END)+
     (CASE WHEN NULLIF(b.overview,'') IS NOT NULL THEN 1 ELSE 0 END)+
     (CASE WHEN NULLIF(b.poster_path,'') IS NOT NULL OR NULLIF(b.external_poster_url,'') IS NOT NULL THEN 1 ELSE 0 END)+
     (CASE WHEN b.release_date IS NOT NULL THEN 1 ELSE 0 END)+
     (CASE WHEN b.director OR NULLIF(b.external_director,'') IS NOT NULL THEN 1 ELSE 0 END)+
     (CASE WHEN b.cast OR NULLIF(b.external_cast,'') IS NOT NULL THEN 1 ELSE 0 END)+
     (CASE WHEN NULLIF(b.backdrop_path,'') IS NOT NULL OR NULLIF(b.external_backdrop_url,'') IS NOT NULL THEN 1 ELSE 0 END)+
     (CASE WHEN NULLIF(b.original_language,'') IS NOT NULL THEN 1 ELSE 0 END)) AS present_count
  FROM base b LEFT JOIN ratings r USING(imdb_id)
), scored AS (
  SELECT f.*,round((f.present_count*100.0/14)::numeric,1) AS coverage,
    (f.fresh_rating_count>=2) AS ratings_ready,
    (f.rating_count>0 AND f.fresh_rating_count=f.rating_count) AS ratings_fresh,
    (f.final_rating IS NOT NULL AND f.pikoscore_version='${VERSION}' AND f.pikoscore_calculated_at IS NOT NULL AND (f.latest_rating_fetched_at IS NULL OR f.pikoscore_calculated_at>=f.latest_rating_fetched_at)) AS piko_current
  FROM facts f
)`;

function filtersSql(p,params){
  const clauses=[];
  if(p.q){params.push(`%${p.q}%`);const n=params.length;clauses.push(`(s.imdb_id ILIKE $${n} OR COALESCE(s.title_es,'') ILIKE $${n} OR COALESCE(s.original_title,'') ILIKE $${n})`);}
  if(p.type==='Película')clauses.push(`s.type='Película'`);
  if(p.type==='Serie')clauses.push(`s.type IN ('Serie','Miniserie')`);
  if(p.plex==='in')clauses.push('s.in_plex');
  if(p.plex==='out')clauses.push('NOT s.in_plex');
  if(p.state==='data_incomplete')clauses.push('NOT s.data_ready');
  if(p.state==='ratings_pending')clauses.push('s.data_ready AND (NOT s.ratings_ready OR NOT s.ratings_fresh)');
  if(p.state==='score_ready')clauses.push('s.data_ready AND s.ratings_ready AND s.ratings_fresh AND NOT s.piko_current');
  if(p.state==='resolved')clauses.push('s.data_ready AND s.ratings_ready AND s.ratings_fresh AND s.piko_current');
  if(p.completion==='improvable')clauses.push('s.coverage<100');
  if(p.completion==='complete')clauses.push('s.coverage=100');
  if(p.stuck)clauses.push(`(NOT s.data_ready OR NOT s.ratings_ready OR NOT s.ratings_fresh OR NOT s.piko_current) AND COALESCE(s.lifecycle_updated_at,'1970-01-01'::timestamptz)<now()-interval '30 days'`);
  return clauses.length?clauses.join(' AND '):'true';
}
function orderSql(p){
  if(p.sort==='title')return `COALESCE(s.title_es,s.original_title,s.imdb_id) ASC`;
  if(p.sort==='coverage')return `s.coverage ASC,COALESCE(s.title_es,s.original_title,s.imdb_id) ASC`;
  if(p.sort==='updated')return `COALESCE(s.lifecycle_updated_at,'1970-01-01'::timestamptz) ASC`;
  if(p.state==='resolved')return `s.coverage ASC,COALESCE(s.title_es,s.original_title,s.imdb_id) ASC`;
  return `CASE WHEN NOT s.data_ready THEN 0 WHEN NOT s.ratings_ready OR NOT s.ratings_fresh THEN 1 WHEN NOT s.piko_current THEN 2 WHEN s.coverage<100 THEN 3 ELSE 4 END,s.coverage ASC,COALESCE(s.title_es,s.original_title,s.imdb_id) ASC`;
}

export async function getDataQualityOverview(){
  const sql=db();
  const [r]=await sql.query(`${QUALITY_CTE} SELECT count(*)::int AS total,
    count(*) FILTER(WHERE NOT data_ready)::int AS incomplete,
    count(*) FILTER(WHERE data_ready AND (NOT ratings_ready OR NOT ratings_fresh))::int AS ratings_pending,
    count(*) FILTER(WHERE data_ready AND ratings_ready AND ratings_fresh AND NOT piko_current)::int AS score_ready,
    count(*) FILTER(WHERE data_ready AND ratings_ready AND ratings_fresh AND piko_current)::int AS resolved,
    count(*) FILTER(WHERE data_ready AND ratings_ready AND ratings_fresh AND piko_current AND coverage=100)::int AS resolved_complete,
    count(*) FILTER(WHERE data_ready AND ratings_ready AND ratings_fresh AND piko_current AND coverage<100)::int AS resolved_improvable,
    count(*) FILTER(WHERE in_plex)::int AS in_plex,
    count(*) FILTER(WHERE (NOT data_ready OR NOT ratings_ready OR NOT ratings_fresh OR NOT piko_current) AND COALESCE(lifecycle_updated_at,'1970-01-01'::timestamptz)<now()-interval '30 days')::int AS stuck,
    COALESCE(round(avg(coverage),1),100) AS average_coverage FROM scored`,[]);
  return{total:Number(r?.total||0),incomplete:Number(r?.incomplete||0),ratingsPending:Number(r?.ratings_pending||0),scoreReady:Number(r?.score_ready||0),resolved:Number(r?.resolved||0),resolvedComplete:Number(r?.resolved_complete||0),resolvedImprovable:Number(r?.resolved_improvable||0),inPlex:Number(r?.in_plex||0),stuck:Number(r?.stuck||0),averageCoverage:Number(r?.average_coverage??100)};
}

const DETAIL_SELECT=`m.imdb_id,m.tmdb_id,m.type,m.title_es,m.original_title,m.year,m.final_rating,m.runtime,m.country,m.poster_path,m.backdrop_path,m.ratings_refreshed_at,m.pikoscore_calculated_at,m.pikoscore_version,m.pikoscore_confidence,
  mm.overview,mm.original_language,mm.release_date,cl.lifecycle_state,COALESCE(m.ratings_refreshed_at,m.pikoscore_calculated_at) AS lifecycle_updated_at,
  COALESCE(m.source_status #>> '{data_quality_external_poster,url}','') AS external_poster_url,
  COALESCE(m.source_status #>> '{data_quality_external_backdrop,url}','') AS external_backdrop_url,
  COALESCE(m.source_status #>> '{data_quality_external_director,value}','') AS external_director,
  COALESCE(m.source_status #>> '{data_quality_external_cast,value}','') AS external_cast,
  (COALESCE(crm.effective_status,'missing')='in_plex') AS in_plex,
  EXISTS(SELECT 1 FROM movie_genres g WHERE g.imdb_id=m.imdb_id) AS genres,
  EXISTS(SELECT 1 FROM movie_credits c WHERE c.imdb_id=m.imdb_id AND c.credit_type='crew' AND c.job='Director') AS director,
  EXISTS(SELECT 1 FROM movie_credits c WHERE c.imdb_id=m.imdb_id AND c.credit_type='cast') AS cast,
  COALESCE((SELECT jsonb_agg(jsonb_build_object('source',tr.source,'rating',tr.normalized_rating,'votes',tr.votes,'provider',tr.provider,'fetched_at',tr.fetched_at,'expires_at',tr.expires_at,'status',tr.status) ORDER BY tr.source) FROM title_ratings tr WHERE tr.imdb_id=m.imdb_id),'[]'::jsonb) AS normalized_ratings`;

async function hydrate(ids){
  if(!ids.length)return[];
  const sql=db();
  return sql.query(`SELECT ${DETAIL_SELECT} FROM catalog_lifecycle cl JOIN movies m USING(imdb_id) LEFT JOIN movie_metadata mm USING(imdb_id) LEFT JOIN catalog_read_model crm ON crm.imdb_id=m.imdb_id WHERE m.imdb_id=ANY($1::text[])`,[ids]);
}

export async function getDataQualityPage(filters={}){
  const p=parse(filters),sql=db(),params=[],where=filtersSql(p,params),offset=(p.page-1)*p.pageSize;
  params.push(p.pageSize);const limitPos=params.length;params.push(offset);const offsetPos=params.length;
  const classified=await sql.query(`${QUALITY_CTE} SELECT s.imdb_id,count(*) OVER()::int AS total_count FROM scored s WHERE ${where} ORDER BY ${orderSql(p)} LIMIT $${limitPos}::int OFFSET $${offsetPos}::int`,params);
  const total=Number(classified[0]?.total_count||0),pages=Math.max(1,Math.ceil(total/p.pageSize)),page=Math.min(p.page,pages);
  if(page!==p.page){return getDataQualityPage({...filters,page});}
  const ids=classified.map(r=>r.imdb_id),rows=await hydrate(ids),byId=new Map(rows.map(r=>[r.imdb_id,assessDataQuality(r)]));
  return{rows:ids.map(id=>byId.get(id)).filter(Boolean),total,state:p.state,sort:p.sort,page,pages,pageSize:p.pageSize};
}
