import 'server-only';
import {db} from './db';
import {freshnessDays} from './pikoscore';
import {PIKOSCORE_V3_VERSION} from './pikoscore-v3-core.mjs';

export const DATA_FIELDS={
  title_es:{label:'Título español',severity:'critical',requiredFor:['RATINGS']},original_title:{label:'Título original',severity:'critical',requiredFor:['RATINGS']},year:{label:'Año',severity:'critical',requiredFor:['RATINGS']},type:{label:'Tipo',severity:'critical',requiredFor:['RATINGS']},runtime:{label:'Duración',severity:'critical',requiredFor:['RATINGS']},country:{label:'País',severity:'important',requiredFor:[]},genres:{label:'Géneros',severity:'important',requiredFor:[]},overview:{label:'Sinopsis',severity:'important',requiredFor:[]},poster_path:{label:'Póster',severity:'important',requiredFor:[]},release_date:{label:'Fecha de estreno',severity:'optional',requiredFor:[]},director:{label:'Director',severity:'optional',requiredFor:[]},cast:{label:'Reparto',severity:'optional',requiredFor:[]},backdrop_path:{label:'Backdrop',severity:'optional',requiredFor:[]},original_language:{label:'Idioma original',severity:'optional',requiredFor:[]},
};
const keys=Object.keys(DATA_FIELDS),isSeries=r=>['Serie','Miniserie'].includes(String(r?.type||'')),effectiveSeverity=(k,r)=>k==='runtime'&&isSeries(r)?'optional':DATA_FIELDS[k].severity;
const ageDays=d=>{const t=new Date(d).getTime();return Number.isFinite(t)?Math.max(0,(Date.now()-t)/86400000):Infinity};
const present=(k,v,r)=>k==='poster_path'?Boolean(v||r.external_poster_url):k==='backdrop_path'?Boolean(v||r.external_backdrop_url):k==='director'?Boolean(v||r.external_director):k==='cast'?Boolean(v||r.external_cast):k==='runtime'?Number(v)>0:k==='year'?Number(v)>1800:v!==null&&v!==undefined&&v!==''&&v!==false;
const parsed=r=>{if(Array.isArray(r.normalized_ratings))return r.normalized_ratings;try{return JSON.parse(r.normalized_ratings||'[]')}catch{return[]}};
function ratingState(row){const maxDays=freshnessDays(row),now=Date.now(),ratings=parsed(row).filter(r=>r?.status==='available'&&Number(r?.rating)>0);const sources=ratings.map(r=>{const fetched=new Date(r.fetched_at).getTime(),explicit=r.expires_at?new Date(r.expires_at).getTime():NaN,fallback=Number.isFinite(fetched)?fetched+maxDays*86400000:NaN;const due=Number.isFinite(explicit)&&Number.isFinite(fallback)?Math.min(explicit,fallback):Number.isFinite(explicit)?explicit:fallback;const age=ageDays(r.fetched_at),expired=Number.isFinite(due)?due<=now:age>=maxDays,aging=!expired&&age>=maxDays*.75;return{...r,ageDays:Math.floor(age),freshnessState:expired?'expired':aging?'aging':'fresh',refreshDueAt:Number.isFinite(due)?new Date(due).toISOString():null};});const fresh=sources.filter(r=>r.freshnessState!=='expired'),fetchedDates=sources.map(r=>new Date(r.fetched_at)).filter(d=>!Number.isNaN(d.getTime())).sort((a,b)=>b-a),dueDates=sources.map(r=>new Date(r.refreshDueAt)).filter(d=>!Number.isNaN(d.getTime())).sort((a,b)=>a-b);return{ratings:sources,ratingsFreshDays:maxDays,ratingCount:sources.length,freshRatingCount:fresh.length,ratingsFresh:sources.length>0&&fresh.length===sources.length,ratingsReady:fresh.length>=2,latestRatingFetchedAt:fetchedDates[0]?.toISOString()||null,nextRatingRefreshAt:dueDates[0]?.toISOString()||null};}
export function assessDataQuality(row){const missing=keys.filter(k=>!present(k,row[k],row)),by=s=>missing.filter(k=>effectiveSeverity(k,row)===s),missingCritical=by('critical'),missingImportant=by('important'),missingOptional=by('optional'),fieldSeverity=Object.fromEntries(keys.map(k=>[k,effectiveSeverity(k,row)])),coverage=Math.round((keys.length-missing.length)*1000/keys.length)/10,ratings=ratingState(row),calc=row.pikoscore_calculated_at?new Date(row.pikoscore_calculated_at):null,latest=ratings.latestRatingFetchedAt?new Date(ratings.latestRatingFetchedAt):null,pikoScoreCurrent=Boolean(row.final_rating!=null&&String(row.pikoscore_version||'')===PIKOSCORE_V3_VERSION&&calc&&!Number.isNaN(calc.getTime())&&(!latest||calc>=latest)),dataReady=missingCritical.length===0,ratingsState=!dataReady?'blocked':!ratings.ratingsReady?'pending':!ratings.ratingsFresh?'stale':'ready',dataState=!dataReady?'blocked':missing.length?'improvable':'complete',scoreState=!dataReady||!ratings.ratingsReady?'blocked':pikoScoreCurrent?'current':'due',nextAction=!dataReady?'UPDATE_DATA':!ratings.ratingsReady||!ratings.ratingsFresh?'REFRESH_RATINGS':!pikoScoreCurrent?'CALCULATE_PIKOSCORE':'NONE',state=nextAction!=='NONE'?'REQUIERE_ATENCION':missing.length?'REVISION_PENDIENTE':'RESUELTO',reason=!dataReady?`Faltan ${missingCritical.length} datos críticos`:!ratings.ratingsReady?'No hay suficientes fuentes de rating válidas':!ratings.ratingsFresh?'Hay ratings caducados':!pikoScoreCurrent?'PikoScore debe recalcularse':missingImportant.length?`Faltan ${missingImportant.length} datos importantes`:missingOptional.length?`Faltan ${missingOptional.length} datos opcionales`:'Datos, ratings y PikoScore vigentes',stateSince=row.lifecycle_updated_at||row.ratings_refreshed_at||row.pikoscore_calculated_at||null,stuck=nextAction!=='NONE'&&ageDays(stateSince)>=30;return{...row,...ratings,fieldSeverity,coverage,missing,missingCritical,missingImportant,missingOptional,dataReady,scoreReady:dataReady&&ratings.ratingsReady,pikoScoreCurrent,pikoScoreDue:!pikoScoreCurrent,dataState,ratingsState,scoreState,nextAction,state,reason,isReliable:true,evaluatedAt:new Date().toISOString(),stuck,stuckReason:stuck?`${reason} · ${Math.floor(ageDays(stateSince))} días`:null};}

const PAGE_SIZE=40;
const STAGES=['DATA_INCOMPLETE','PIKOSCORE_PENDING','MOVIE_FILE_PENDING','MOVIE_FILE_REVIEW','SERIES_SYNC_PENDING','SERIES_REVIEW','TECH_PENDING','COMPLETE'];
const safeOne=v=>Array.isArray(v)?v[0]:v;
function parseFilters(filters={}){const type=String(safeOne(filters.type)||'all'),state=String(safeOne(filters.state)||'all'),plex=String(safeOne(filters.plex)||'all'),completion=String(safeOne(filters.completion)||'all'),sort=String(safeOne(filters.sort)||'priority');return{q:String(safeOne(filters.q)||'').trim(),type:['all','Película','Serie'].includes(type)?type:'all',state:['all','data_incomplete','ratings_pending','score_ready','resolved'].includes(state)?state:'all',plex:['all','in','out'].includes(plex)?plex:'all',completion:['all','improvable','complete'].includes(completion)?completion:'all',sort:['priority','title','coverage','updated'].includes(sort)?sort:'priority',stuck:String(safeOne(filters.stuck)||'')==='1',page:Math.max(1,Number(safeOne(filters.page))||1),pageSize:PAGE_SIZE};}

function overviewFromRow(r={}){return{total:Number(r.total||0),incomplete:Number(r.incomplete||0),ratingsPending:Number(r.ratings_pending||0),scoreReady:Number(r.score_ready||0),resolved:Number(r.resolved||0),resolvedComplete:Number(r.resolved_complete||0),resolvedImprovable:Number(r.resolved_improvable||0),inPlex:Number(r.in_plex||0),stuck:Number(r.stuck||0),averageCoverage:Number(r.average_coverage??100)};}

export async function getDataQualityView(filters={}){
  const sql=db(),p=parseFilters(filters),like=`%${p.q}%`,offset=(p.page-1)*p.pageSize;
  const [result]=await sql`
    WITH genre_flags AS (
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
      WHERE ex.imdb_id IS NULL AND cl.lifecycle_state=ANY(${STAGES}::text[])
    ), ratings AS (
      SELECT tr.imdb_id,
        count(*) FILTER(WHERE tr.status='available' AND COALESCE(tr.normalized_rating,0)>0)::int AS rating_count,
        count(*) FILTER(WHERE tr.status='available' AND COALESCE(tr.normalized_rating,0)>0 AND COALESCE(tr.expires_at,tr.fetched_at+(b.fresh_days||' days')::interval)>now())::int AS fresh_rating_count,
        max(tr.fetched_at) FILTER(WHERE tr.status='available' AND COALESCE(tr.normalized_rating,0)>0) AS latest_rating_fetched_at,
        min(COALESCE(tr.expires_at,tr.fetched_at+(b.fresh_days||' days')::interval)) FILTER(WHERE tr.status='available' AND COALESCE(tr.normalized_rating,0)>0) AS next_rating_refresh_at
      FROM title_ratings tr JOIN base b USING(imdb_id) GROUP BY tr.imdb_id
    ), scored AS MATERIALIZED (
      SELECT b.*,COALESCE(r.rating_count,0)::int AS rating_count,COALESCE(r.fresh_rating_count,0)::int AS fresh_rating_count,
        r.latest_rating_fetched_at,r.next_rating_refresh_at,
        (NULLIF(b.title_es,'') IS NOT NULL AND NULLIF(b.original_title,'') IS NOT NULL AND b.year>1800 AND NULLIF(b.type,'') IS NOT NULL AND (b.type IN ('Serie','Miniserie') OR COALESCE(b.runtime,0)>0)) AS data_ready,
        round((((CASE WHEN NULLIF(b.title_es,'') IS NOT NULL THEN 1 ELSE 0 END)+(CASE WHEN NULLIF(b.original_title,'') IS NOT NULL THEN 1 ELSE 0 END)+(CASE WHEN b.year>1800 THEN 1 ELSE 0 END)+(CASE WHEN NULLIF(b.type,'') IS NOT NULL THEN 1 ELSE 0 END)+(CASE WHEN COALESCE(b.runtime,0)>0 THEN 1 ELSE 0 END)+(CASE WHEN NULLIF(b.country,'') IS NOT NULL THEN 1 ELSE 0 END)+(CASE WHEN b.genres THEN 1 ELSE 0 END)+(CASE WHEN NULLIF(b.overview,'') IS NOT NULL THEN 1 ELSE 0 END)+(CASE WHEN NULLIF(b.poster_path,'') IS NOT NULL OR NULLIF(b.external_poster_url,'') IS NOT NULL THEN 1 ELSE 0 END)+(CASE WHEN b.release_date IS NOT NULL THEN 1 ELSE 0 END)+(CASE WHEN b.director OR NULLIF(b.external_director,'') IS NOT NULL THEN 1 ELSE 0 END)+(CASE WHEN b.cast OR NULLIF(b.external_cast,'') IS NOT NULL THEN 1 ELSE 0 END)+(CASE WHEN NULLIF(b.backdrop_path,'') IS NOT NULL OR NULLIF(b.external_backdrop_url,'') IS NOT NULL THEN 1 ELSE 0 END)+(CASE WHEN NULLIF(b.original_language,'') IS NOT NULL THEN 1 ELSE 0 END))*100.0/14)::numeric,1) AS coverage,
        (COALESCE(r.fresh_rating_count,0)>=2) AS ratings_ready,
        (COALESCE(r.rating_count,0)>0 AND COALESCE(r.fresh_rating_count,0)=COALESCE(r.rating_count,0)) AS ratings_fresh,
        (b.final_rating IS NOT NULL AND b.pikoscore_version=${String(PIKOSCORE_V3_VERSION)} AND b.pikoscore_calculated_at IS NOT NULL AND (r.latest_rating_fetched_at IS NULL OR b.pikoscore_calculated_at>=r.latest_rating_fetched_at)) AS piko_current
      FROM base b LEFT JOIN ratings r USING(imdb_id)
    ), filtered AS (
      SELECT s.* FROM scored s
      WHERE (${p.q}='' OR s.imdb_id ILIKE ${like} OR COALESCE(s.title_es,'') ILIKE ${like} OR COALESCE(s.original_title,'') ILIKE ${like})
        AND (${p.type}='all' OR (${p.type}='Película' AND s.type='Película') OR (${p.type}='Serie' AND s.type IN ('Serie','Miniserie')))
        AND (${p.plex}='all' OR (${p.plex}='in' AND s.in_plex) OR (${p.plex}='out' AND NOT s.in_plex))
        AND (${p.state}='all'
          OR (${p.state}='data_incomplete' AND NOT s.data_ready)
          OR (${p.state}='ratings_pending' AND s.data_ready AND (NOT s.ratings_ready OR NOT s.ratings_fresh))
          OR (${p.state}='score_ready' AND s.data_ready AND s.ratings_ready AND s.ratings_fresh AND NOT s.piko_current)
          OR (${p.state}='resolved' AND s.data_ready AND s.ratings_ready AND s.ratings_fresh AND s.piko_current))
        AND (${p.completion}='all' OR (${p.completion}='improvable' AND s.coverage<100) OR (${p.completion}='complete' AND s.coverage=100))
        AND (${p.stuck}=false OR ((NOT s.data_ready OR NOT s.ratings_ready OR NOT s.ratings_fresh OR NOT s.piko_current) AND COALESCE(s.lifecycle_updated_at,'1970-01-01'::timestamptz)<now()-interval '30 days'))
    ), paged AS (
      SELECT f.*,row_number() OVER() AS _row
      FROM filtered f
      ORDER BY
        CASE WHEN ${p.sort}='title' THEN lower(COALESCE(f.title_es,f.original_title,f.imdb_id)) END ASC,
        CASE WHEN ${p.sort}='coverage' OR (${p.sort}='priority' AND ${p.state}='resolved') THEN f.coverage END ASC,
        CASE WHEN ${p.sort}='updated' THEN COALESCE(f.lifecycle_updated_at,'1970-01-01'::timestamptz) END ASC,
        CASE WHEN ${p.sort}='priority' AND ${p.state}<>'resolved' THEN CASE WHEN NOT f.data_ready THEN 0 WHEN NOT f.ratings_ready OR NOT f.ratings_fresh THEN 1 WHEN NOT f.piko_current THEN 2 WHEN f.coverage<100 THEN 3 ELSE 4 END END ASC,
        CASE WHEN ${p.sort}='priority' AND ${p.state}<>'resolved' THEN f.coverage END ASC,
        lower(COALESCE(f.title_es,f.original_title,f.imdb_id)) ASC,f.imdb_id ASC
      LIMIT ${p.pageSize} OFFSET ${offset}
    ), summary AS (
      SELECT count(*)::int AS total,
        count(*) FILTER(WHERE NOT data_ready)::int AS incomplete,
        count(*) FILTER(WHERE data_ready AND (NOT ratings_ready OR NOT ratings_fresh))::int AS ratings_pending,
        count(*) FILTER(WHERE data_ready AND ratings_ready AND ratings_fresh AND NOT piko_current)::int AS score_ready,
        count(*) FILTER(WHERE data_ready AND ratings_ready AND ratings_fresh AND piko_current)::int AS resolved,
        count(*) FILTER(WHERE data_ready AND ratings_ready AND ratings_fresh AND piko_current AND coverage=100)::int AS resolved_complete,
        count(*) FILTER(WHERE data_ready AND ratings_ready AND ratings_fresh AND piko_current AND coverage<100)::int AS resolved_improvable,
        count(*) FILTER(WHERE in_plex)::int AS in_plex,
        count(*) FILTER(WHERE (NOT data_ready OR NOT ratings_ready OR NOT ratings_fresh OR NOT piko_current) AND COALESCE(lifecycle_updated_at,'1970-01-01'::timestamptz)<now()-interval '30 days')::int AS stuck,
        COALESCE(round(avg(coverage),1),100) AS average_coverage
      FROM scored
    )
    SELECT summary.*,
      (SELECT count(*)::int FROM filtered) AS filtered_total,
      COALESCE((SELECT jsonb_agg(to_jsonb(p) || jsonb_build_object('normalized_ratings',COALESCE((SELECT jsonb_agg(jsonb_build_object('source',tr.source,'rating',tr.normalized_rating,'votes',tr.votes,'provider',tr.provider,'fetched_at',tr.fetched_at,'expires_at',tr.expires_at,'status',tr.status) ORDER BY tr.source) FROM title_ratings tr WHERE tr.imdb_id=p.imdb_id),'[]'::jsonb)) ORDER BY p._row) FROM paged p),'[]'::jsonb) AS page_rows
    FROM summary`;

  const overview=overviewFromRow(result),total=Number(result?.filtered_total||0),rawRows=Array.isArray(result?.page_rows)?result.page_rows:[];
  const rows=rawRows.map(r=>{delete r._row;return assessDataQuality(r);});
  return{overview,page:{rows,total,state:p.state,sort:p.sort,page:p.page,pages:Math.max(1,Math.ceil(total/p.pageSize)),pageSize:p.pageSize}};
}

export async function getDataQualityOverview(){return (await getDataQualityView()).overview;}
export async function getDataQualityPage(filters={}){return (await getDataQualityView(filters)).page;}

export async function getDataQualityTitle(imdbId){
  const sql=db(),id=String(imdbId||'');
  const [row]=await sql`SELECT m.imdb_id,m.tmdb_id,m.type,m.title_es,m.original_title,m.year,m.final_rating,m.runtime,m.country,m.poster_path,m.backdrop_path,m.ratings_refreshed_at,m.pikoscore_calculated_at,m.pikoscore_version,m.pikoscore_confidence,mm.overview,mm.original_language,mm.release_date,cl.lifecycle_state,COALESCE(m.ratings_refreshed_at,m.pikoscore_calculated_at) AS lifecycle_updated_at,COALESCE(m.source_status #>> '{data_quality_external_poster,url}','') AS external_poster_url,COALESCE(m.source_status #>> '{data_quality_external_backdrop,url}','') AS external_backdrop_url,COALESCE(m.source_status #>> '{data_quality_external_director,value}','') AS external_director,COALESCE(m.source_status #>> '{data_quality_external_cast,value}','') AS external_cast,EXISTS(SELECT 1 FROM movie_genres g WHERE g.imdb_id=m.imdb_id) AS genres,EXISTS(SELECT 1 FROM movie_credits c WHERE c.imdb_id=m.imdb_id AND c.credit_type='crew' AND c.job='Director') AS director,EXISTS(SELECT 1 FROM movie_credits c WHERE c.imdb_id=m.imdb_id AND c.credit_type='cast') AS cast,(COALESCE(crm.effective_status,'missing')='in_plex') AS in_plex,COALESCE((SELECT jsonb_agg(jsonb_build_object('source',tr.source,'rating',tr.normalized_rating,'votes',tr.votes,'provider',tr.provider,'fetched_at',tr.fetched_at,'expires_at',tr.expires_at,'status',tr.status) ORDER BY tr.source) FROM title_ratings tr WHERE tr.imdb_id=m.imdb_id),'[]'::jsonb) AS normalized_ratings FROM catalog_lifecycle cl JOIN movies m USING(imdb_id) LEFT JOIN movie_metadata mm USING(imdb_id) LEFT JOIN catalog_exclusions ex USING(imdb_id) LEFT JOIN catalog_read_model crm ON crm.imdb_id=m.imdb_id WHERE m.imdb_id=${id} AND ex.imdb_id IS NULL AND cl.lifecycle_state=ANY(${STAGES}::text[]) LIMIT 1`;
  return row?assessDataQuality(row):null;
}
