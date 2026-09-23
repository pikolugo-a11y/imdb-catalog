import 'server-only';
import {db} from './db';
import {PIKOQUALITY_ACTIVE_VERSION} from './pikoquality-version.mjs';
import {PIKORELEVANCE_VERSION} from './pikorelevance-core.mjs';

export const CATALOG_V4_PAGE_SIZE=50;
const SERIES_TYPES=['Serie','Miniserie'];
const SORTS=new Set(['score','relevance','quality','spain','year','title']);
const DIRS=new Set(['asc','desc']);
const SCOPES=new Set(['all','movies','series']);
const VIEWS=new Set(['list','posters']);
const PLEX=new Set(['all','in_plex','without_plex']);

const first=v=>Array.isArray(v)?v[0]:v;
const integer=v=>{const n=Number.parseInt(first(v),10);return Number.isFinite(n)?n:null};
const norm=s=>String(s||'').normalize('NFD').replace(/\p{Diacritic}/gu,'').toLowerCase().trim();
const dbNorm=x=>`translate(lower(COALESCE(${x},'')),'áéíóúüñ','aeiouun')`;
const list=v=>[...new Set(String(first(v)||'').split(',').map(x=>x.trim()).filter(Boolean))];
const defaultSort=({scope})=>scope==='series'?'relevance':'score';

export function parseCatalogV4(raw={}){
  const legacyType=first(raw.type),scopeRaw=first(raw.scope)||(legacyType==='movie'?'movies':legacyType==='series'?'series':'all');
  const scope=SCOPES.has(scopeRaw)?scopeRaw:'all';
  const legacyView=first(raw.view),view=legacyView==='grid'?'posters':VIEWS.has(legacyView)?legacyView:'list';
  const plexRaw=first(raw.plex)||first(raw.status),plex=plexRaw==='missing'?'without_plex':PLEX.has(plexRaw)?plexRaw:'all';
  const fallbackSort=defaultSort({scope,plex}),rawSort=first(raw.sort),requestedSort=SORTS.has(rawSort)?rawSort:fallbackSort;
  const sort=(requestedSort==='spain'||requestedSort==='relevance')&&scope!=='series'?fallbackSort:requestedSort;
  const defaultDir=sort==='title'?'asc':'desc',dir=DIRS.has(first(raw.dir))?first(raw.dir):defaultDir;
  const q=String(first(raw.q)||'').trim();
  const countries=list(first(raw.countries)||first(raw.country));
  const countryMode=first(raw.countryMode)==='all'?'all':'any';
  const genres=list(first(raw.genres)||first(raw.genre));
  const genreMode=first(raw.genreMode)==='all'?'all':'any';
  const yearFrom=integer(raw.yearFrom),yearTo=integer(raw.yearTo),page=Math.max(1,integer(raw.page)||1);
  const invalidYearRange=yearFrom!=null&&yearTo!=null&&yearFrom>yearTo;
  return{scope,view,sort,dir,plex,q,countries,countryMode,genres,genreMode,yearFrom,yearTo,page,invalidYearRange};
}

export function catalogV4Href(state,patch={}){
  const s={...state,...patch},fallbackSort=defaultSort(s),requestedSort=s.sort||fallbackSort;
  const effectiveSort=(requestedSort==='spain'||requestedSort==='relevance')&&s.scope!=='series'?fallbackSort:requestedSort;
  const p=new URLSearchParams();
  if(s.scope&&s.scope!=='all')p.set('scope',s.scope);
  if(s.view&&s.view!=='list')p.set('view',s.view);
  if(effectiveSort!==fallbackSort)p.set('sort',effectiveSort);
  const defaultDir=effectiveSort==='title'?'asc':'desc';if(s.dir&&s.dir!==defaultDir)p.set('dir',s.dir);
  if(s.plex&&s.plex!=='all')p.set('plex',s.plex);
  if(s.q)p.set('q',s.q);
  if(s.countries?.length)p.set('countries',s.countries.join(','));
  if(s.countries?.length&&s.countryMode==='all')p.set('countryMode','all');
  if(s.genres?.length)p.set('genres',s.genres.join(','));
  if(s.genres?.length&&s.genreMode==='all')p.set('genreMode','all');
  if(s.yearFrom!=null)p.set('yearFrom',String(s.yearFrom));
  if(s.yearTo!=null)p.set('yearTo',String(s.yearTo));
  if(Number(s.page)>1)p.set('page',String(s.page));
  const x=p.toString();return `/catalogo${x?`?${x}`:''}`;
}

function countryArraySql(){
  return `COALESCE(
    (SELECT array_agg(DISTINCT ctry.name_es ORDER BY ctry.name_es)
      FROM movie_countries mc JOIN countries ctry ON ctry.code=mc.country_code
      WHERE mc.imdb_id=c.imdb_id),
    CASE WHEN NULLIF(trim(mv.country),'') IS NOT NULL
      THEN regexp_split_to_array(mv.country,'\\s*,\\s*')
      ELSE '{}'::text[] END
  )`;
}

function whereSql(p,params,{includePlex=true}={}){
  const w=['c.imdb_id IS NOT NULL'];
  const add=(v,make)=>{params.push(v);w.push(make(params.length))};
  if(p.scope==='movies')w.push(`c.type='Película'`);
  if(p.scope==='series')w.push(`c.type=ANY($${params.push(SERIES_TYPES)}::text[])`);
  if(includePlex&&p.plex==='in_plex')w.push(`c.effective_status='in_plex'`);
  if(includePlex&&p.plex==='without_plex')w.push(`c.effective_status<>'in_plex'`);
  if(p.q){const nq=`%${norm(p.q)}%`;add(nq,i=>`(${dbNorm('c.display_title')} LIKE $${i} OR ${dbNorm('c.original_title')} LIKE $${i} OR lower(c.imdb_id)=lower($${i+1}))`);params.push(p.q);}
  if(p.countries.length){
    params.push(p.countries);const i=params.length,op=p.countryMode==='all'?'@>':'&&';
    w.push(`(${countryArraySql()} ${op} $${i}::text[])`);
  }
  if(p.yearFrom!=null)add(p.yearFrom,i=>`c.year >= $${i}`);
  if(p.yearTo!=null)add(p.yearTo,i=>`c.year <= $${i}`);
  if(p.genres.length){
    params.push(p.genres);const i=params.length;
    if(p.genreMode==='all')w.push(`(SELECT count(DISTINCT g.name_es) FROM movie_genres_canonical mgc JOIN genres g ON g.id=mgc.genre_id WHERE mgc.imdb_id=c.imdb_id AND g.name_es=ANY($${i}::text[]))=${p.genres.length}`);
    else w.push(`EXISTS(SELECT 1 FROM movie_genres_canonical mgc JOIN genres g ON g.id=mgc.genre_id WHERE mgc.imdb_id=c.imdb_id AND g.name_es=ANY($${i}::text[]))`);
  }
  return w.join(' AND ');
}

const qualityExpr=`CASE WHEN c.effective_status<>'in_plex' THEN NULL WHEN c.type='Película' THEN pq.score/10.0 ELSE pqa.score/10.0 END`;

function orderSql(p){
  const t=`translate(lower(COALESCE(c.display_title,'')),'áéíóúüñ','aeiouun')`;
  if(p.sort==='relevance')return `sra.score ${p.dir.toUpperCase()} NULLS LAST,c.final_rating DESC NULLS LAST,${t} ASC,c.imdb_id ASC`;
  if(p.sort==='quality')return `${qualityExpr} ${p.dir.toUpperCase()} NULLS LAST,c.final_rating DESC NULLS LAST,${t} ASC,c.imdb_id ASC`;
  if(p.sort==='spain')return `spr.spain_priority ${p.dir.toUpperCase()} NULLS LAST,c.final_rating DESC NULLS LAST,${t} ASC,c.imdb_id ASC`;
  if(p.sort==='year')return `c.year ${p.dir.toUpperCase()} NULLS LAST,c.final_rating DESC NULLS LAST,${t} ASC,c.imdb_id ASC`;
  if(p.sort==='title')return `${t} ${p.dir.toUpperCase()},c.year DESC NULLS LAST,c.imdb_id ASC`;
  return `c.final_rating ${p.dir.toUpperCase()} NULLS LAST,c.year DESC NULLS LAST,${t} ASC,c.imdb_id ASC`;
}

const baseSql=`FROM catalog_read_model c
LEFT JOIN movies mv ON mv.imdb_id=c.imdb_id
LEFT JOIN plex_catalog_status pcs ON pcs.imdb_id=c.imdb_id AND pcs.status='in_plex'
LEFT JOIN plex_technical_state pts ON pts.rating_key=pcs.rating_key AND pts.snapshot_status='ready' AND pts.technical_fingerprint IS NOT NULL
LEFT JOIN piko_quality pq ON pq.rating_key=pcs.rating_key AND pq.status='evaluated' AND pq.formula_version=$1 AND pq.source_fingerprint IS NOT DISTINCT FROM pts.technical_fingerprint
LEFT JOIN piko_quality_aggregates pqa ON pqa.entity_type='show' AND pqa.entity_key=pcs.rating_key AND pqa.formula_version=$1
LEFT JOIN series_relevance_assessments sra ON sra.imdb_id=c.imdb_id AND sra.formula_version=$2`;
const structureJoin=`LEFT JOIN LATERAL(SELECT max(official_seasons)::int official_seasons,max(official_episodes)::int official_episodes FROM series_reference sr0 WHERE sr0.imdb_id=c.imdb_id) sr ON true`;
const priorityCte=`WITH series_votes AS (
 SELECT c2.imdb_id,COALESCE(ir.votes,0)::float8 votes,c2.final_rating,percent_rank() OVER(ORDER BY COALESCE(ir.votes,0)) global_pct
 FROM catalog_read_model c2 LEFT JOIN title_ratings ir ON ir.imdb_id=c2.imdb_id AND ir.source='imdb' AND ir.status='available'
 WHERE c2.type IN ('Serie','Miniserie')
), country_rank AS (
 SELECT sv.imdb_id,mc.country_code,percent_rank() OVER(PARTITION BY mc.country_code ORDER BY sv.votes) market_pct
 FROM series_votes sv JOIN movie_countries mc ON mc.imdb_id=sv.imdb_id
), country_signal AS (
 SELECT imdb_id,avg(market_pct)::float8 market_pct,bool_or(country_code='ES') is_es FROM country_rank GROUP BY imdb_id
), series_priority AS (
 SELECT sv.imdb_id,
  35*COALESCE(cs.market_pct,sv.global_pct)+20*sv.global_pct+1.5*COALESCE(sv.final_rating,0)
  +CASE WHEN COALESCE(cs.is_es,false) THEN 20 ELSE 0 END
  +CASE WHEN mm.original_language='es' THEN 5 ELSE 0 END
  +CASE WHEN COALESCE(m.source_status #>> '{series_profile,spain,streaming}','false')='true' THEN 20 ELSE 0 END AS spain_priority
 FROM series_votes sv LEFT JOIN country_signal cs ON cs.imdb_id=sv.imdb_id LEFT JOIN movies m ON m.imdb_id=sv.imdb_id LEFT JOIN movie_metadata mm ON mm.imdb_id=sv.imdb_id
)`;

export async function getCatalogV4(raw={}){
  const p=parseCatalogV4(raw);
  if(p.invalidYearRange)return{state:p,rows:[],summary:{total:0,in_plex:0,without_plex:0,profile_due:0},filteredTotal:0,pageCount:1,page:1};
  const sql=db();
  const rowParams=[PIKOQUALITY_ACTIVE_VERSION,PIKORELEVANCE_VERSION],summaryParams=[PIKOQUALITY_ACTIVE_VERSION,PIKORELEVANCE_VERSION];
  const where=whereSql(p,rowParams),summaryWhere=whereSql(p,summaryParams,{includePlex:false}),order=orderSql(p);
  const [[summary],[countRow]]=await Promise.all([
    sql.query(`SELECT count(*)::int total,count(*) FILTER(WHERE c.effective_status='in_plex')::int in_plex,count(*) FILTER(WHERE c.effective_status<>'in_plex')::int without_plex,count(*) FILTER(WHERE c.type IN ('Serie','Miniserie') AND mv.tmdb_id IS NOT NULL AND (NULLIF(mv.source_status #>> '{series_profile,seasons}','') IS NULL OR NULLIF(mv.source_status #>> '{series_profile,episodes}','') IS NULL))::int profile_due ${baseSql} WHERE ${summaryWhere}`,summaryParams),
    sql.query(`SELECT count(*)::int total ${baseSql} WHERE ${where}`,rowParams)
  ]);
  const filteredTotal=Number(countRow?.total||0),pageCount=Math.max(1,Math.ceil(filteredTotal/CATALOG_V4_PAGE_SIZE)),page=Math.min(p.page,pageCount),offset=(page-1)*CATALOG_V4_PAGE_SIZE;
  const prefix=p.sort==='spain'?priorityCte:'';
  const priorityJoin=p.sort==='spain'?'LEFT JOIN series_priority spr ON spr.imdb_id=c.imdb_id':'';
  const rows=await sql.query(`${prefix} SELECT c.imdb_id,c.display_title,c.original_title,c.year,c.type,c.poster_path,c.final_rating,c.effective_status,${countryArraySql()} countries,${qualityExpr} pikoquality,COALESCE(sr.official_seasons,NULLIF(mv.source_status #>> '{series_profile,seasons}','')::int) series_seasons,COALESCE(sr.official_episodes,NULLIF(mv.source_status #>> '{series_profile,episodes}','')::int) series_episodes,COALESCE(mv.source_status #>> '{series_profile,spain,streaming}','false')='true' spain_streaming,COALESCE((SELECT array_agg(g.name_es ORDER BY g.name_es) FROM movie_genres_canonical mgc JOIN genres g ON g.id=mgc.genre_id WHERE mgc.imdb_id=c.imdb_id),c.genres,'{}'::text[]) genres,sra.score pikorelevancia ${baseSql} ${structureJoin} ${priorityJoin} WHERE ${where} ORDER BY ${order} LIMIT ${CATALOG_V4_PAGE_SIZE} OFFSET ${offset}`,rowParams);
  return{state:{...p,page},rows,summary:summary||{total:0,in_plex:0,without_plex:0,profile_due:0},filteredTotal,pageCount,page};
}

export async function getCatalogV4Genres(){const sql=db();const rows=await sql`SELECT name_es value FROM genres WHERE COALESCE(name_es,'')<>'' ORDER BY name_es`;return rows.map(r=>r.value)}
export async function getCatalogV4Countries(){const sql=db();const rows=await sql`SELECT DISTINCT ctry.name_es value FROM movie_countries mc JOIN countries ctry ON ctry.code=mc.country_code JOIN catalog_read_model c ON c.imdb_id=mc.imdb_id WHERE COALESCE(ctry.name_es,'')<>'' ORDER BY ctry.name_es`;return rows.map(r=>r.value)}
