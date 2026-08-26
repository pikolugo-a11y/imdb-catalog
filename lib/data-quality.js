import 'server-only';
import {db} from './db';
import {freshnessDays} from './pikoscore';
import {PIKOSCORE_V3_VERSION} from './pikoscore-v3-core.mjs';

export const DATA_FIELDS={
  title_es:{label:'Título español',severity:'critical',requiredFor:['RATINGS']},
  original_title:{label:'Título original',severity:'critical',requiredFor:['RATINGS']},
  year:{label:'Año',severity:'critical',requiredFor:['RATINGS']},
  type:{label:'Tipo',severity:'critical',requiredFor:['RATINGS']},
  runtime:{label:'Duración',severity:'critical',requiredFor:['RATINGS']},
  country:{label:'País',severity:'important',requiredFor:[]},
  genres:{label:'Géneros',severity:'important',requiredFor:[]},
  overview:{label:'Sinopsis',severity:'important',requiredFor:[]},
  poster_path:{label:'Póster',severity:'important',requiredFor:[]},
  release_date:{label:'Fecha de estreno',severity:'optional',requiredFor:[]},
  director:{label:'Director',severity:'optional',requiredFor:[]},
  cast:{label:'Reparto',severity:'optional',requiredFor:[]},
  backdrop_path:{label:'Backdrop',severity:'optional',requiredFor:[]},
  original_language:{label:'Idioma original',severity:'optional',requiredFor:[]},
};

const keys=Object.keys(DATA_FIELDS);
const isSeries=r=>['Serie','Miniserie'].includes(String(r?.type||''));
const effectiveSeverity=(k,r)=>k==='runtime'&&isSeries(r)?'optional':DATA_FIELDS[k].severity;
const ageDays=d=>{const t=new Date(d).getTime();return Number.isFinite(t)?Math.max(0,(Date.now()-t)/86400000):Infinity};
const present=(k,v,r)=>k==='poster_path'?Boolean(v||r.external_poster_url):k==='backdrop_path'?Boolean(v||r.external_backdrop_url):k==='director'?Boolean(v||r.external_director):k==='cast'?Boolean(v||r.external_cast):k==='runtime'?Number(v)>0:k==='year'?Number(v)>1800:v!==null&&v!==undefined&&v!==''&&v!==false;
const parsed=r=>{if(Array.isArray(r.normalized_ratings))return r.normalized_ratings;try{return JSON.parse(r.normalized_ratings||'[]')}catch{return[]}};

function ratingState(row){
  const maxDays=freshnessDays(row),now=Date.now(),ratings=parsed(row).filter(r=>r?.status==='available'&&Number(r?.rating)>0);
  const sources=ratings.map(r=>{
    const fetched=new Date(r.fetched_at).getTime(),explicit=r.expires_at?new Date(r.expires_at).getTime():NaN,fallback=Number.isFinite(fetched)?fetched+maxDays*86400000:NaN;
    const due=Number.isFinite(explicit)&&Number.isFinite(fallback)?Math.min(explicit,fallback):Number.isFinite(explicit)?explicit:fallback;
    const age=ageDays(r.fetched_at),expired=Number.isFinite(due)?due<=now:age>=maxDays,aging=!expired&&age>=maxDays*.75;
    return{...r,ageDays:Math.floor(age),freshnessState:expired?'expired':aging?'aging':'fresh',refreshDueAt:Number.isFinite(due)?new Date(due).toISOString():null};
  });
  const fresh=sources.filter(r=>r.freshnessState!=='expired');
  const fetchedDates=sources.map(r=>new Date(r.fetched_at)).filter(d=>!Number.isNaN(d.getTime())).sort((a,b)=>b-a);
  const dueDates=sources.map(r=>new Date(r.refreshDueAt)).filter(d=>!Number.isNaN(d.getTime())).sort((a,b)=>a-b);
  return{ratings:sources,ratingsFreshDays:maxDays,ratingCount:sources.length,freshRatingCount:fresh.length,ratingsFresh:sources.length>0&&fresh.length===sources.length,ratingsReady:fresh.length>=2,latestRatingFetchedAt:fetchedDates[0]?.toISOString()||null,nextRatingRefreshAt:dueDates[0]?.toISOString()||null};
}

export function assessDataQuality(row){
  const missing=keys.filter(k=>!present(k,row[k],row)),by=s=>missing.filter(k=>effectiveSeverity(k,row)===s);
  const missingCritical=by('critical'),missingImportant=by('important'),missingOptional=by('optional'),fieldSeverity=Object.fromEntries(keys.map(k=>[k,effectiveSeverity(k,row)]));
  const coverage=Math.round((keys.length-missing.length)*1000/keys.length)/10,ratings=ratingState(row);
  const calc=row.pikoscore_calculated_at?new Date(row.pikoscore_calculated_at):null,latest=ratings.latestRatingFetchedAt?new Date(ratings.latestRatingFetchedAt):null;
  const pikoScoreCurrent=Boolean(row.final_rating!=null&&String(row.pikoscore_version||'')===PIKOSCORE_V3_VERSION&&calc&&!Number.isNaN(calc.getTime())&&(!latest||calc>=latest));
  const dataReady=missingCritical.length===0,ratingsState=!dataReady?'blocked':!ratings.ratingsReady?'pending':!ratings.ratingsFresh?'stale':'ready';
  const dataState=!dataReady?'blocked':missing.length?'improvable':'complete',scoreState=!dataReady||!ratings.ratingsReady?'blocked':pikoScoreCurrent?'current':'due';
  const nextAction=!dataReady?'UPDATE_DATA':!ratings.ratingsReady||!ratings.ratingsFresh?'REFRESH_RATINGS':!pikoScoreCurrent?'CALCULATE_PIKOSCORE':'NONE';
  const state=nextAction!=='NONE'?'REQUIERE_ATENCION':missing.length?'REVISION_PENDIENTE':'RESUELTO';
  const reason=!dataReady?`Faltan ${missingCritical.length} datos críticos`:!ratings.ratingsReady?'No hay suficientes fuentes de rating válidas':!ratings.ratingsFresh?'Hay ratings caducados':!pikoScoreCurrent?'PikoScore debe recalcularse':missingImportant.length?`Faltan ${missingImportant.length} datos importantes`:missingOptional.length?`Faltan ${missingOptional.length} datos opcionales`:'Datos, ratings y PikoScore vigentes';
  const stateSince=row.lifecycle_updated_at||row.ratings_refreshed_at||row.pikoscore_calculated_at||null,stuck=nextAction!=='NONE'&&ageDays(stateSince)>=30;
  return{...row,...ratings,fieldSeverity,coverage,missing,missingCritical,missingImportant,missingOptional,dataReady,scoreReady:dataReady&&ratings.ratingsReady,pikoScoreCurrent,pikoScoreDue:!pikoScoreCurrent,dataState,ratingsState,scoreState,nextAction,state,reason,isReliable:true,evaluatedAt:new Date().toISOString(),stuck,stuckReason:stuck?`${reason} · ${Math.floor(ageDays(stateSince))} días`:null};
}

const DATA_QUALITY_STAGES=`'DATA_INCOMPLETE','PIKOSCORE_PENDING','MOVIE_FILE_PENDING','MOVIE_FILE_REVIEW','SERIES_SYNC_PENDING','SERIES_REVIEW','TECH_PENDING','COMPLETE'`;
const SAFE_VERSION=String(PIKOSCORE_V3_VERSION).replace(/'/g,"''");

const QUALITY_CTE=`
WITH genre_flags AS (
  SELECT imdb_id, true AS genres FROM movie_genres GROUP BY imdb_id
), director_flags AS (
  SELECT imdb_id, true AS director FROM movie_credits WHERE credit_type='crew' AND job='Director' GROUP BY imdb_id
), cast_flags AS (
  SELECT imdb_id, true AS cast FROM movie_credits WHERE credit_type='cast' GROUP BY imdb_id
), plex_flags AS (
  SELECT DISTINCT px.external_id AS imdb_id
  FROM plex_items pi
  JOIN plex_external_ids px ON px.rating_key=pi.rating_key AND px.provider='imdb'
  WHERE pi.active AND pi.item_type IN ('movie','show')
), base AS (
  SELECT
    m.imdb_id,m.tmdb_id,m.type,m.title_es,m.original_title,m.year,m.final_rating,m.runtime,m.country,m.poster_path,m.backdrop_path,m.source_status,
    m.ratings_refreshed_at,m.pikoscore_calculated_at,m.pikoscore_version,m.pikoscore_confidence,
    mm.overview,mm.original_language,mm.release_date,v.validation_status,cl.lifecycle_state,
    COALESCE(m.ratings_refreshed_at,m.pikoscore_calculated_at) AS lifecycle_updated_at,
    COALESCE(m.source_status #>> '{data_quality_external_poster,url}','') AS external_poster_url,
    COALESCE(m.source_status #>> '{data_quality_external_backdrop,url}','') AS external_backdrop_url,
    COALESCE(m.source_status #>> '{data_quality_external_director,value}','') AS external_director,
    COALESCE(m.source_status #>> '{data_quality_external_cast,value}','') AS external_cast,
    COALESCE(g.genres,false) AS genres,COALESCE(d.director,false) AS director,COALESCE(c.cast,false) AS cast,
    (p.imdb_id IS NOT NULL) AS in_plex,
    CASE
      WHEN COALESCE(mm.release_date::date,CASE WHEN m.year BETWEEN 1801 AND 9999 THEN make_date(m.year,1,1) END) > CURRENT_DATE-INTERVAL '3 months' THEN 14
      WHEN COALESCE(mm.release_date::date,CASE WHEN m.year BETWEEN 1801 AND 9999 THEN make_date(m.year,1,1) END) > CURRENT_DATE-INTERVAL '1 year' THEN 30
      WHEN COALESCE(mm.release_date::date,CASE WHEN m.year BETWEEN 1801 AND 9999 THEN make_date(m.year,1,1) END) > CURRENT_DATE-INTERVAL '3 years' THEN 90
      WHEN COALESCE(mm.release_date::date,CASE WHEN m.year BETWEEN 1801 AND 9999 THEN make_date(m.year,1,1) END) > CURRENT_DATE-INTERVAL '10 years' THEN 180
      ELSE 365
    END AS fresh_days
  FROM catalog_lifecycle cl
  JOIN movies m USING(imdb_id)
  LEFT JOIN movie_metadata mm USING(imdb_id)
  LEFT JOIN identity_validation v USING(imdb_id)
  LEFT JOIN catalog_exclusions ex USING(imdb_id)
  LEFT JOIN genre_flags g USING(imdb_id)
  LEFT JOIN director_flags d USING(imdb_id)
  LEFT JOIN cast_flags c USING(imdb_id)
  LEFT JOIN plex_flags p USING(imdb_id)
  WHERE ex.imdb_id IS NULL AND cl.lifecycle_state IN (${DATA_QUALITY_STAGES})
), ratings AS (
  SELECT
    tr.imdb_id,
    count(*) FILTER (WHERE tr.status='available' AND COALESCE(tr.normalized_rating,0)>0) AS rating_count,
    count(*) FILTER (
      WHERE tr.status='available' AND COALESCE(tr.normalized_rating,0)>0
      AND COALESCE(tr.expires_at,tr.fetched_at+(b.fresh_days||' days')::interval)>now()
    ) AS fresh_rating_count,
    max(tr.fetched_at) FILTER (WHERE tr.status='available' AND COALESCE(tr.normalized_rating,0)>0) AS latest_rating_fetched_at,
    min(COALESCE(tr.expires_at,tr.fetched_at+(b.fresh_days||' days')::interval)) FILTER (WHERE tr.status='available' AND COALESCE(tr.normalized_rating,0)>0) AS next_rating_refresh_at
  FROM title_ratings tr JOIN base b USING(imdb_id)
  GROUP BY tr.imdb_id
), facts AS (
  SELECT b.*,
    COALESCE(r.rating_count,0)::int AS rating_count,
    COALESCE(r.fresh_rating_count,0)::int AS fresh_rating_count,
    r.latest_rating_fetched_at,r.next_rating_refresh_at,
    (
      NULLIF(b.title_es,'') IS NOT NULL AND NULLIF(b.original_title,'') IS NOT NULL AND b.year>1800 AND NULLIF(b.type,'') IS NOT NULL
      AND (b.type IN ('Serie','Miniserie') OR COALESCE(b.runtime,0)>0)
    ) AS data_ready,
    (
      (CASE WHEN NULLIF(b.title_es,'') IS NOT NULL THEN 1 ELSE 0 END)+
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
      (CASE WHEN NULLIF(b.original_language,'') IS NOT NULL THEN 1 ELSE 0 END)
    ) AS present_count
  FROM base b LEFT JOIN ratings r USING(imdb_id)
), scored AS (
  SELECT f.*,
    round((f.present_count*100.0/14)::numeric,1) AS coverage,
    (f.fresh_rating_count>=2) AS ratings_ready,
    (f.rating_count>0 AND f.fresh_rating_count=f.rating_count) AS ratings_fresh,
    (
      f.final_rating IS NOT NULL AND f.pikoscore_version='${SAFE_VERSION}' AND f.pikoscore_calculated_at IS NOT NULL
      AND (f.latest_rating_fetched_at IS NULL OR f.pikoscore_calculated_at>=f.latest_rating_fetched_at)
    ) AS piko_current
  FROM facts f
)`;

function pageFilterSql(state,completion,stuck){
  const clauses=[];
  if(state==='data_incomplete')clauses.push('NOT s.data_ready');
  else if(state==='ratings_pending')clauses.push('s.data_ready AND (NOT s.ratings_ready OR NOT s.ratings_fresh)');
  else if(state==='score_ready')clauses.push('s.data_ready AND s.ratings_ready AND s.ratings_fresh AND NOT s.piko_current');
  else if(state==='resolved')clauses.push('s.data_ready AND s.ratings_ready AND s.ratings_fresh AND s.piko_current');
  if(completion==='improvable')clauses.push('s.coverage<100');
  else if(completion==='complete')clauses.push('s.coverage=100');
  if(stuck)clauses.push(`(NOT s.data_ready OR NOT s.ratings_ready OR NOT s.ratings_fresh OR NOT s.piko_current) AND COALESCE(s.lifecycle_updated_at,'1970-01-01'::timestamptz)<now()-interval '30 days'`);
  return clauses.length?` AND ${clauses.join(' AND ')}`:'';
}

function orderSql(sort,state){
  if(sort==='title')return `COALESCE(s.title_es,s.original_title,s.imdb_id) ASC`;
  if(sort==='coverage')return `s.coverage ASC,COALESCE(s.title_es,s.original_title,s.imdb_id) ASC`;
  if(sort==='updated')return `COALESCE(s.lifecycle_updated_at,'1970-01-01'::timestamptz) ASC`;
  if(state==='resolved')return `s.coverage ASC,COALESCE(s.title_es,s.original_title,s.imdb_id) ASC`;
  return `CASE WHEN NOT s.data_ready THEN 0 WHEN NOT s.ratings_ready OR NOT s.ratings_fresh THEN 1 WHEN NOT s.piko_current THEN 2 WHEN s.coverage<100 THEN 3 ELSE 4 END, s.coverage ASC, COALESCE(s.title_es,s.original_title,s.imdb_id) ASC`;
}

function filterParams(filters={}){
  const q=String(filters.q||'').trim(),type=String(filters.type||'all'),plex=String(filters.plex||'all');
  return{q,type,plex,like:`%${q}%`};
}

const FILTER_SQL=`($1='' OR s.imdb_id ILIKE $2 OR COALESCE(s.title_es,'') ILIKE $2 OR COALESCE(s.original_title,'') ILIKE $2) AND ($3='all' OR lower(COALESCE(s.type,''))=lower($3)) AND ($4='all' OR ($4='in' AND s.in_plex) OR ($4='out' AND NOT s.in_plex))`;

export async function getDataQualityOverview(){
  const sql=db();
  const [row]=await sql.unsafe(`${QUALITY_CTE}
SELECT
  count(*)::int AS total,
  count(*) FILTER (WHERE NOT data_ready)::int AS incomplete,
  count(*) FILTER (WHERE data_ready AND (NOT ratings_ready OR NOT ratings_fresh))::int AS ratings_pending,
  count(*) FILTER (WHERE data_ready AND ratings_ready AND ratings_fresh AND NOT piko_current)::int AS score_ready,
  count(*) FILTER (WHERE data_ready AND ratings_ready AND ratings_fresh AND piko_current)::int AS resolved,
  count(*) FILTER (WHERE data_ready AND ratings_ready AND ratings_fresh AND piko_current AND coverage=100)::int AS resolved_complete,
  count(*) FILTER (WHERE data_ready AND ratings_ready AND ratings_fresh AND piko_current AND coverage<100)::int AS resolved_improvable,
  count(*) FILTER (WHERE in_plex)::int AS in_plex,
  count(*) FILTER (WHERE (NOT data_ready OR NOT ratings_ready OR NOT ratings_fresh OR NOT piko_current) AND COALESCE(lifecycle_updated_at,'1970-01-01'::timestamptz)<now()-interval '30 days')::int AS stuck,
  COALESCE(round(avg(coverage),1),100) AS average_coverage
FROM scored`);
  return{total:Number(row?.total||0),incomplete:Number(row?.incomplete||0),ratingsPending:Number(row?.ratings_pending||0),scoreReady:Number(row?.score_ready||0),resolved:Number(row?.resolved||0),resolvedComplete:Number(row?.resolved_complete||0),resolvedImprovable:Number(row?.resolved_improvable||0),inPlex:Number(row?.in_plex||0),stuck:Number(row?.stuck||0),averageCoverage:Number(row?.average_coverage??100)};
}

export async function getDataQualityPage(filters={}){
  const sql=db(),state=String(filters.state||'all'),sort=String(filters.sort||'priority'),stuck=String(filters.stuck||'')==='1',completion=String(filters.completion||'all'),page=Math.max(1,Number(filters.page)||1),pageSize=40;
  const {q,type,plex,like}=filterParams(filters),offset=(page-1)*pageSize;
  const rows=await sql.unsafe(`${QUALITY_CTE}
, filtered AS (
  SELECT s.*,count(*) OVER()::int AS total_count
  FROM scored s
  WHERE ${FILTER_SQL}${pageFilterSql(state,completion,stuck)}
  ORDER BY ${orderSql(sort,state)}
  LIMIT $5 OFFSET $6
)
SELECT f.*,
  COALESCE((SELECT jsonb_agg(jsonb_build_object('source',tr.source,'rating',tr.normalized_rating,'votes',tr.votes,'provider',tr.provider,'fetched_at',tr.fetched_at,'expires_at',tr.expires_at,'status',tr.status) ORDER BY tr.source) FROM title_ratings tr WHERE tr.imdb_id=f.imdb_id),'[]'::jsonb) AS normalized_ratings
FROM filtered f
ORDER BY ${orderSql(sort,state)}`,[q,like,type,plex,pageSize,offset]);
  const assessed=rows.map(assessDataQuality),total=Number(rows[0]?.total_count||0);
  return{rows:assessed,total,state,sort,page,pages:Math.max(1,Math.ceil(total/pageSize)),pageSize};
}

export async function getDataQualityTitle(imdbId){
  const sql=db();
  const rows=await sql.unsafe(`${QUALITY_CTE}
SELECT s.*,
  COALESCE((SELECT jsonb_agg(jsonb_build_object('source',tr.source,'rating',tr.normalized_rating,'votes',tr.votes,'provider',tr.provider,'fetched_at',tr.fetched_at,'expires_at',tr.expires_at,'status',tr.status) ORDER BY tr.source) FROM title_ratings tr WHERE tr.imdb_id=s.imdb_id),'[]'::jsonb) AS normalized_ratings
FROM scored s WHERE s.imdb_id=$1 LIMIT 1`,[String(imdbId||'')]);
  return rows[0]?assessDataQuality(rows[0]):null;
}
