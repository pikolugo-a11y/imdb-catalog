import 'server-only';
import {db} from './db';
import {attachLifecycle} from './lifecycle';

const movieType='Película';
const seriesTypes=['Serie','Miniserie'];
const GRID_PAGE_SIZE=42;
const LIST_PAGE_SIZE=50;
const SORTS=new Set(['score','title','year','imdb','votes','runtime','type','status']);

function one(v){return Array.isArray(v)?v[0]:v}
function cleanList(v){const raw=Array.isArray(v)?v.join(','):String(v||'');return [...new Set(raw.split(',').map(x=>x.trim()).filter(Boolean))].slice(0,12)}
function int(v){const n=Number.parseInt(one(v),10);return Number.isFinite(n)?n:null}
function parse(filters={}){
  const q=String(one(filters.q)||'').trim().toLowerCase();
  const type=String(one(filters.type)||'');
  const status=String(one(filters.status)||'');
  const legacyGenre=String(one(filters.genre)||'').trim();
  const genres=cleanList(filters.genres||legacyGenre);
  const genreMode=String(one(filters.genreMode)||'any')==='all'?'all':'any';
  const legacyYear=int(filters.year);
  let yearFrom=int(filters.yearFrom)??legacyYear;
  let yearTo=int(filters.yearTo)??legacyYear;
  if(yearFrom&&yearTo&&yearFrom>yearTo)[yearFrom,yearTo]=[yearTo,yearFrom];
  const page=Math.max(1,int(filters.page)||1);
  const view=String(one(filters.view)||'grid')==='list'?'list':'grid';
  const requestedSort=String(one(filters.sort)||'score');
  const sort=SORTS.has(requestedSort)?requestedSort:'score';
  const defaultDir=sort==='title'?'asc':'desc';
  const dir=String(one(filters.dir)||defaultDir)==='asc'?'asc':'desc';
  const pageSize=view==='list'?LIST_PAGE_SIZE:GRID_PAGE_SIZE;
  return{q,type,status,genres,genreMode,yearFrom,yearTo,page,view,sort,dir,pageSize};
}
function params(filters){const p=parse(filters);return {...p,genreCount:p.genres.length,offset:(p.page-1)*p.pageSize}}

export async function getCatalogV3(filters={}){
  const sql=db();
  const {q,type,status,genres,genreMode,genreCount,yearFrom,yearTo,offset,pageSize,sort,dir}=params(filters);
  const rows=await sql`SELECT c.imdb_id,c.type,c.display_title,c.original_title,c.year,c.runtime,
    COALESCE(cn.countries_es,c.country) country,
    CASE WHEN mv.pikoscore_version LIKE '3.0.0%' AND mv.pikoscore_calculated_at IS NOT NULL THEN mv.final_rating ELSE NULL END final_rating,
    imdb.normalized_rating::float8 imdb_rating,imdb.votes::bigint imdb_votes,
    tmdb.normalized_rating::float8 tmdb_rating,tmdb.votes::bigint tmdb_votes,
    COALESCE((SELECT array_agg(g.name_es ORDER BY g.name_es) FROM movie_genres_canonical mgc JOIN genres g ON g.id=mgc.genre_id WHERE mgc.imdb_id=c.imdb_id),c.genres) genres,
    c.effective_status,c.plex_status,c.resolution,c.collection_name,c.poster_path,c.tmdb_id,c.tmdb_collection_id
    FROM catalog_read_model c
    JOIN movies mv ON mv.imdb_id=c.imdb_id
    LEFT JOIN title_ratings imdb ON imdb.imdb_id=c.imdb_id AND imdb.source='imdb' AND imdb.status='available'
    LEFT JOIN title_ratings tmdb ON tmdb.imdb_id=c.imdb_id AND tmdb.source='tmdb' AND tmdb.status='available'
    LEFT JOIN movie_country_names cn ON cn.imdb_id=c.imdb_id
    WHERE (${q}='' OR lower(c.display_title) LIKE ${'%'+q+'%'} OR lower(COALESCE(c.original_title,'')) LIKE ${'%'+q+'%'})
      AND (${type}='' OR (${type}='movie' AND c.type=${movieType}) OR (${type}='series' AND c.type=ANY(${seriesTypes})))
      AND (${yearFrom}::int IS NULL OR c.year>=${yearFrom}) AND (${yearTo}::int IS NULL OR c.year<=${yearTo})
      AND (${genreCount}=0 OR (${genreMode}='any' AND EXISTS(SELECT 1 FROM movie_genres_canonical mgc JOIN genres g ON g.id=mgc.genre_id WHERE mgc.imdb_id=c.imdb_id AND g.name_es=ANY(${genres}))) OR (${genreMode}='all' AND (SELECT count(DISTINCT g.name_es) FROM movie_genres_canonical mgc JOIN genres g ON g.id=mgc.genre_id WHERE mgc.imdb_id=c.imdb_id AND g.name_es=ANY(${genres}))=${genreCount}))
      AND (${status}='' OR (${status}='in_plex' AND c.effective_status='in_plex') OR (${status}='acquiring' AND c.effective_status='acquiring') OR (${status}='missing' AND (c.effective_status NOT IN ('in_plex','acquiring') OR c.effective_status IS NULL)))
    ORDER BY
      CASE WHEN ${sort}='title' AND ${dir}='asc' THEN lower(c.display_title) END ASC NULLS LAST, CASE WHEN ${sort}='title' AND ${dir}='desc' THEN lower(c.display_title) END DESC NULLS LAST,
      CASE WHEN ${sort}='year' AND ${dir}='asc' THEN c.year END ASC NULLS LAST, CASE WHEN ${sort}='year' AND ${dir}='desc' THEN c.year END DESC NULLS LAST,
      CASE WHEN ${sort}='score' AND ${dir}='asc' THEN CASE WHEN mv.pikoscore_version LIKE '3.0.0%' THEN mv.final_rating END END ASC NULLS LAST, CASE WHEN ${sort}='score' AND ${dir}='desc' THEN CASE WHEN mv.pikoscore_version LIKE '3.0.0%' THEN mv.final_rating END END DESC NULLS LAST,
      CASE WHEN ${sort}='imdb' AND ${dir}='asc' THEN imdb.normalized_rating END ASC NULLS LAST, CASE WHEN ${sort}='imdb' AND ${dir}='desc' THEN imdb.normalized_rating END DESC NULLS LAST,
      CASE WHEN ${sort}='votes' AND ${dir}='asc' THEN imdb.votes END ASC NULLS LAST, CASE WHEN ${sort}='votes' AND ${dir}='desc' THEN imdb.votes END DESC NULLS LAST,
      CASE WHEN ${sort}='runtime' AND ${dir}='asc' THEN c.runtime END ASC NULLS LAST, CASE WHEN ${sort}='runtime' AND ${dir}='desc' THEN c.runtime END DESC NULLS LAST,
      CASE WHEN ${sort}='type' AND ${dir}='asc' THEN c.type END ASC NULLS LAST, CASE WHEN ${sort}='type' AND ${dir}='desc' THEN c.type END DESC NULLS LAST,
      CASE WHEN ${sort}='status' AND ${dir}='asc' THEN COALESCE(c.effective_status,'missing') END ASC NULLS LAST, CASE WHEN ${sort}='status' AND ${dir}='desc' THEN COALESCE(c.effective_status,'missing') END DESC NULLS LAST,
      CASE WHEN mv.pikoscore_version LIKE '3.0.0%' THEN mv.final_rating END DESC NULLS LAST,imdb.votes DESC NULLS LAST,c.imdb_id
    LIMIT ${pageSize} OFFSET ${offset}`;
  return attachLifecycle(rows);
}

export async function getCatalogStatsV3(filters={}){
  const sql=db();const {q,type,status,genres,genreMode,genreCount,yearFrom,yearTo}=params(filters);
  const [row]=await sql`SELECT count(*)::int total,count(*) FILTER(WHERE c.effective_status='in_plex')::int in_plex,count(*) FILTER(WHERE c.effective_status='acquiring')::int acquiring,count(*) FILTER(WHERE c.effective_status NOT IN ('in_plex','acquiring') OR c.effective_status IS NULL)::int missing FROM catalog_read_model c WHERE (${q}='' OR lower(c.display_title) LIKE ${'%'+q+'%'} OR lower(COALESCE(c.original_title,'')) LIKE ${'%'+q+'%'}) AND (${type}='' OR (${type}='movie' AND c.type=${movieType}) OR (${type}='series' AND c.type=ANY(${seriesTypes}))) AND (${yearFrom}::int IS NULL OR c.year>=${yearFrom}) AND (${yearTo}::int IS NULL OR c.year<=${yearTo}) AND (${genreCount}=0 OR (${genreMode}='any' AND EXISTS(SELECT 1 FROM movie_genres_canonical mgc JOIN genres g ON g.id=mgc.genre_id WHERE mgc.imdb_id=c.imdb_id AND g.name_es=ANY(${genres}))) OR (${genreMode}='all' AND (SELECT count(DISTINCT g.name_es) FROM movie_genres_canonical mgc JOIN genres g ON g.id=mgc.genre_id WHERE mgc.imdb_id=c.imdb_id AND g.name_es=ANY(${genres}))=${genreCount})) AND (${status}='' OR (${status}='in_plex' AND c.effective_status='in_plex') OR (${status}='acquiring' AND c.effective_status='acquiring') OR (${status}='missing' AND (c.effective_status NOT IN ('in_plex','acquiring') OR c.effective_status IS NULL)))`;return row;
}
export async function getCatalogFiltersV3(){const sql=db();const [genres,range]=await Promise.all([sql`SELECT name_es value FROM genres ORDER BY name_es`,sql`SELECT min(year)::int min_year,max(year)::int max_year FROM catalog_read_model WHERE year IS NOT NULL`]);return{genres:genres.map(x=>x.value),minYear:range[0]?.min_year||1900,maxYear:range[0]?.max_year||new Date().getFullYear()};}
export function catalogPageSize(view='grid'){return view==='list'?LIST_PAGE_SIZE:GRID_PAGE_SIZE}
