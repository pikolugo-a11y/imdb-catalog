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
const ageDays=d=>{const t=new Date(d).getTime();return Number.isFinite(t)?Math.max(0,(Date.now()-t)/86400000):Infinity};
const present=(k,v,r)=>k==='poster_path'?Boolean(v||r.external_poster_url):k==='backdrop_path'?Boolean(v||r.external_backdrop_url):k==='director'?Boolean(v||r.external_director):k==='cast'?Boolean(v||r.external_cast):k==='runtime'?isSeries(r)||Number(v)>0:k==='year'?Number(v)>1800:v!==null&&v!==undefined&&v!==''&&v!==false;
const parsed=r=>{if(Array.isArray(r.normalized_ratings))return r.normalized_ratings;try{return JSON.parse(r.normalized_ratings||'[]')}catch{return[]}};

function ratingState(row){
  const maxDays=freshnessDays(row),now=Date.now(),ratings=parsed(row).filter(r=>r?.status==='available'&&Number(r?.rating)>0);
  const sources=ratings.map(r=>{
    const fetched=new Date(r.fetched_at).getTime(),explicit=new Date(r.expires_at).getTime(),fallback=Number.isFinite(fetched)?fetched+maxDays*86400000:NaN;
    const due=Number.isFinite(explicit)&&Number.isFinite(fallback)?Math.min(explicit,fallback):Number.isFinite(explicit)?explicit:fallback;
    const age=ageDays(r.fetched_at),expired=Number.isFinite(due)?due<=now:age>=maxDays,aging=!expired&&age>=maxDays*.75;
    return{...r,ageDays:Math.floor(age),freshnessState:expired?'expired':aging?'aging':'fresh',refreshDueAt:Number.isFinite(due)?new Date(due).toISOString():null};
  });
  const fresh=sources.filter(r=>r.freshnessState!=='expired');
  const fetchedDates=sources.map(r=>new Date(r.fetched_at)).filter(d=>!Number.isNaN(d.getTime())).sort((a,b)=>b-a);
  const dueDates=sources.map(r=>new Date(r.refreshDueAt)).filter(d=>!Number.isNaN(d.getTime())).sort((a,b)=>a-b);
  return{
    ratings:sources,
    ratingsFreshDays:maxDays,
    ratingCount:sources.length,
    freshRatingCount:fresh.length,
    ratingsFresh:sources.length>0&&fresh.length===sources.length,
    ratingsReady:fresh.length>=2,
    latestRatingFetchedAt:fetchedDates[0]?.toISOString()||null,
    nextRatingRefreshAt:dueDates[0]?.toISOString()||null,
  };
}

export function assessDataQuality(row){
  const rowKeys=isSeries(row)?keys.filter(k=>k!=='runtime'):keys;
  const missing=rowKeys.filter(k=>!present(k,row[k],row)),by=s=>missing.filter(k=>DATA_FIELDS[k].severity===s);
  const missingCritical=by('critical'),missingImportant=by('important'),missingOptional=by('optional');
  const coverage=Math.round((rowKeys.length-missing.length)*1000/rowKeys.length)/10,ratings=ratingState(row);
  const calc=row.pikoscore_calculated_at?new Date(row.pikoscore_calculated_at):null,latest=ratings.latestRatingFetchedAt?new Date(ratings.latestRatingFetchedAt):null;
  const pikoScoreCurrent=Boolean(row.final_rating!=null&&String(row.pikoscore_version||'')===PIKOSCORE_V3_VERSION&&calc&&!Number.isNaN(calc.getTime())&&(!latest||calc>=latest));
  const dataReady=missingCritical.length===0,ratingsState=!dataReady?'blocked':!ratings.ratingsReady?'pending':!ratings.ratingsFresh?'stale':'ready';
  const dataState=!dataReady?'blocked':missing.length?'improvable':'complete',scoreState=!dataReady||!ratings.ratingsReady?'blocked':pikoScoreCurrent?'current':'due';
  const nextAction=!dataReady?'UPDATE_DATA':!ratings.ratingsReady||!ratings.ratingsFresh?'REFRESH_RATINGS':!pikoScoreCurrent?'CALCULATE_PIKOSCORE':'NONE';
  const state=nextAction!=='NONE'?'REQUIERE_ATENCION':missing.length?'REVISION_PENDIENTE':'RESUELTO';
  const reason=!dataReady?`Faltan ${missingCritical.length} datos críticos`:!ratings.ratingsReady?'No hay suficientes fuentes de rating válidas':!ratings.ratingsFresh?'Hay ratings caducados':!pikoScoreCurrent?'PikoScore debe recalcularse':missingImportant.length?`Faltan ${missingImportant.length} datos importantes`:missingOptional.length?`Faltan ${missingOptional.length} datos opcionales`:'Datos, ratings y PikoScore vigentes';
  const stateSince=row.lifecycle_updated_at||row.ratings_refreshed_at||row.pikoscore_calculated_at||null,stuck=nextAction!=='NONE'&&ageDays(stateSince)>=30;
  return{...row,...ratings,coverage,missing,missingCritical,missingImportant,missingOptional,dataReady,scoreReady:dataReady&&ratings.ratingsReady,pikoScoreCurrent,pikoScoreDue:!pikoScoreCurrent,dataState,ratingsState,scoreState,nextAction,state,reason,isReliable:true,evaluatedAt:new Date().toISOString(),stuck,stuckReason:stuck?`${reason} · ${Math.floor(ageDays(stateSince))} días`:null};
}

const PLEX_EXISTS=`EXISTS(SELECT 1 FROM plex_items pi JOIN plex_external_ids px ON px.rating_key=pi.rating_key AND px.provider='imdb' WHERE pi.active AND pi.item_type IN ('movie','show') AND px.external_id=m.imdb_id)`;
const SELECT=`m.imdb_id,m.tmdb_id,m.type,m.title_es,m.original_title,m.year,m.final_rating,m.runtime,m.country,m.poster_path,m.backdrop_path,m.source_status,m.ratings_refreshed_at,m.pikoscore_calculated_at,m.pikoscore_version,m.pikoscore_confidence,mm.overview,mm.original_language,mm.release_date,v.validation_status,cl.lifecycle_state,COALESCE(m.ratings_refreshed_at,m.pikoscore_calculated_at) lifecycle_updated_at,COALESCE(m.source_status #>> '{data_quality_external_poster,url}','') external_poster_url,COALESCE(m.source_status #>> '{data_quality_external_backdrop,url}','') external_backdrop_url,COALESCE(m.source_status #>> '{data_quality_external_director,value}','') external_director,COALESCE(m.source_status #>> '{data_quality_external_cast,value}','') external_cast,${PLEX_EXISTS} in_plex,EXISTS(SELECT 1 FROM movie_genres g WHERE g.imdb_id=m.imdb_id) genres,EXISTS(SELECT 1 FROM movie_credits c WHERE c.imdb_id=m.imdb_id AND c.credit_type='crew' AND c.job='Director') director,EXISTS(SELECT 1 FROM movie_credits c WHERE c.imdb_id=m.imdb_id AND c.credit_type='cast') cast,COALESCE((SELECT jsonb_agg(jsonb_build_object('source',tr.source,'rating',tr.normalized_rating,'votes',tr.votes,'provider',tr.provider,'fetched_at',tr.fetched_at,'expires_at',tr.expires_at,'status',tr.status) ORDER BY tr.source) FROM title_ratings tr WHERE tr.imdb_id=m.imdb_id),'[]'::jsonb) normalized_ratings`;
const DATA_QUALITY_STAGES=`'DATA_INCOMPLETE','PIKOSCORE_PENDING','MOVIE_FILE_PENDING','MOVIE_FILE_REVIEW','SERIES_SYNC_PENDING','SERIES_REVIEW','TECH_PENDING','COMPLETE'`;

async function universe(filters={}){
  const sql=db(),q=String(filters.q||'').trim(),type=String(filters.type||'all'),plex=String(filters.plex||'all'),like=`%${q}%`;
  return sql.unsafe(`SELECT ${SELECT} FROM catalog_lifecycle cl JOIN movies m USING(imdb_id) LEFT JOIN movie_metadata mm USING(imdb_id) LEFT JOIN identity_validation v USING(imdb_id) LEFT JOIN catalog_exclusions ex USING(imdb_id) WHERE ex.imdb_id IS NULL AND cl.lifecycle_state IN (${DATA_QUALITY_STAGES}) AND ($1='' OR m.imdb_id ILIKE $2 OR COALESCE(m.title_es,'') ILIKE $2 OR COALESCE(m.original_title,'') ILIKE $2) AND ($3='all' OR lower(COALESCE(m.type,''))=lower($3)) AND ($4='all' OR ($4='in' AND ${PLEX_EXISTS}) OR ($4='out' AND NOT ${PLEX_EXISTS}))`,[q,like,type,plex]);
}
const operationallyResolved=r=>r.dataReady&&r.ratingsReady&&r.ratingsFresh&&r.pikoScoreCurrent;

export async function getDataQualityOverview(){
  const rows=(await universe()).map(assessDataQuality),resolved=rows.filter(operationallyResolved);
  return{
    total:rows.length,
    incomplete:rows.filter(r=>!r.dataReady).length,
    ratingsPending:rows.filter(r=>r.dataReady&&(!r.ratingsReady||!r.ratingsFresh)).length,
    scoreReady:rows.filter(r=>r.dataReady&&r.ratingsReady&&r.ratingsFresh&&!r.pikoScoreCurrent).length,
    resolved:resolved.length,
    resolvedComplete:resolved.filter(r=>r.coverage===100).length,
    resolvedImprovable:resolved.filter(r=>r.coverage<100).length,
    inPlex:rows.filter(r=>r.in_plex).length,
    stuck:rows.filter(r=>r.stuck).length,
    averageCoverage:rows.length?Math.round(rows.reduce((s,r)=>s+r.coverage,0)*10/rows.length)/10:100,
  };
}

export async function getDataQualityPage(filters={}){
  const state=String(filters.state||'all'),sort=String(filters.sort||'priority'),stuck=String(filters.stuck||'')==='1',completion=String(filters.completion||'all'),page=Math.max(1,Number(filters.page)||1),pageSize=40;
  let rows=(await universe(filters)).map(assessDataQuality);
  if(state==='data_incomplete')rows=rows.filter(r=>!r.dataReady);
  if(state==='ratings_pending')rows=rows.filter(r=>r.dataReady&&(!r.ratingsReady||!r.ratingsFresh));
  if(state==='score_ready')rows=rows.filter(r=>r.dataReady&&r.ratingsReady&&r.ratingsFresh&&!r.pikoScoreCurrent);
  if(state==='resolved')rows=rows.filter(operationallyResolved);
  if(completion==='improvable')rows=rows.filter(r=>r.coverage<100);
  if(completion==='complete')rows=rows.filter(r=>r.coverage===100);
  if(stuck)rows=rows.filter(r=>r.stuck);
  const priority=r=>!r.dataReady?0:!r.ratingsReady||!r.ratingsFresh?1:!r.pikoScoreCurrent?2:r.coverage<100?3:4;
  const comparator=sort==='title'?(a,b)=>String(a.title_es||a.original_title).localeCompare(String(b.title_es||b.original_title),'es'):sort==='coverage'?(a,b)=>a.coverage-b.coverage:sort==='updated'?(a,b)=>new Date(a.lifecycle_updated_at||0)-new Date(b.lifecycle_updated_at||0):state==='resolved'?(a,b)=>a.coverage-b.coverage||String(a.title_es||'').localeCompare(String(b.title_es||''),'es'):(a,b)=>priority(a)-priority(b)||a.coverage-b.coverage||String(a.title_es||'').localeCompare(String(b.title_es||''),'es');
  rows.sort(comparator);
  const total=rows.length,start=(page-1)*pageSize;
  return{rows:rows.slice(start,start+pageSize),total,state,sort,page,pages:Math.max(1,Math.ceil(total/pageSize)),pageSize};
}

export async function getDataQualityTitle(imdbId){
  const rows=await universe({q:imdbId});
  return rows[0]?assessDataQuality(rows[0]):null;
}
