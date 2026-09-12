import 'server-only';
import {db} from './db';
import {PIKOQUALITY_ACTIVE_VERSION} from './pikoquality-version.mjs';

export const CATALOG_V4_PAGE_SIZE=50;
const SERIES_TYPES=['Serie','Miniserie'];
const SORTS=new Set(['score','year','title']);
const DIRS=new Set(['asc','desc']);
const SCOPES=new Set(['all','movies','series']);
const VIEWS=new Set(['list','posters']);
const PLEX=new Set(['all','in_plex','without_plex']);

const first=v=>Array.isArray(v)?v[0]:v;
const integer=v=>{const n=Number.parseInt(first(v),10);return Number.isFinite(n)?n:null};
const norm=s=>String(s||'').normalize('NFD').replace(/\p{Diacritic}/gu,'').toLowerCase().trim();
const dbNorm=x=>`translate(lower(COALESCE(${x},'')),'áéíóúüñ','aeiouun')`;

export function parseCatalogV4(raw={}){
  const legacyType=first(raw.type),scopeRaw=first(raw.scope)||(legacyType==='movie'?'movies':legacyType==='series'?'series':'all');
  const scope=SCOPES.has(scopeRaw)?scopeRaw:'all';
  const legacyView=first(raw.view),view=legacyView==='grid'?'posters':VIEWS.has(legacyView)?legacyView:'list';
  const sort=SORTS.has(first(raw.sort))?first(raw.sort):'score';
  const defaultDir=sort==='title'?'asc':'desc',dir=DIRS.has(first(raw.dir))?first(raw.dir):defaultDir;
  const plexRaw=first(raw.plex)||first(raw.status),plex=plexRaw==='missing'?'without_plex':PLEX.has(plexRaw)?plexRaw:'all';
  const q=String(first(raw.q)||'').trim();
  const country=String(first(raw.country)||'').trim();
  const genres=[...new Set(String(first(raw.genres)||first(raw.genre)||'').split(',').map(x=>x.trim()).filter(Boolean))];
  const genreMode=first(raw.genreMode)==='all'?'all':'any';
  const yearFrom=integer(raw.yearFrom),yearTo=integer(raw.yearTo),page=Math.max(1,integer(raw.page)||1);
  const invalidYearRange=yearFrom!=null&&yearTo!=null&&yearFrom>yearTo;
  return{scope,view,sort,dir,plex,q,country,genres,genreMode,yearFrom,yearTo,page,invalidYearRange};
}

export function catalogV4Href(state,patch={}){
  const s={...state,...patch};
  const p=new URLSearchParams();
  if(s.scope&&s.scope!=='all')p.set('scope',s.scope);
  if(s.view&&s.view!=='list')p.set('view',s.view);
  if(s.sort&&s.sort!=='score')p.set('sort',s.sort);
  const defaultDir=(s.sort||'score')==='title'?'asc':'desc';if(s.dir&&s.dir!==defaultDir)p.set('dir',s.dir);
  if(s.plex&&s.plex!=='all')p.set('plex',s.plex);
  if(s.q)p.set('q',s.q);
  if(s.country)p.set('country',s.country);
  if(s.genres?.length)p.set('genres',s.genres.join(','));
  if(s.genres?.length&&s.genreMode==='all')p.set('genreMode','all');
  if(s.yearFrom!=null)p.set('yearFrom',String(s.yearFrom));
  if(s.yearTo!=null)p.set('yearTo',String(s.yearTo));
  if(Number(s.page)>1)p.set('page',String(s.page));
  const x=p.toString();return `/catalogo${x?`?${x}`:''}`;
}

function whereSql(p,params){
  const w=['c.imdb_id IS NOT NULL'];
  const add=(v,make)=>{params.push(v);w.push(make(params.length))};
  if(p.scope==='movies')w.push(`c.type='Película'`);
  if(p.scope==='series')w.push(`c.type=ANY($${params.push(SERIES_TYPES)}::text[])`);
  if(p.plex==='in_plex')w.push(`c.effective_status='in_plex'`);
  if(p.plex==='without_plex')w.push(`c.effective_status<>'in_plex'`);
  if(p.q){const nq=`%${norm(p.q)}%`;add(nq,i=>`(${dbNorm('c.display_title')} LIKE $${i} OR ${dbNorm('c.original_title')} LIKE $${i} OR lower(c.imdb_id)=lower($${i+1}))`);params.push(p.q);}
  if(p.country)add(p.country,i=>`EXISTS(SELECT 1 FROM movie_countries mc JOIN countries ctry ON ctry.code=mc.country_code WHERE mc.imdb_id=c.imdb_id AND ctry.name_es=$${i})`);
  if(p.yearFrom!=null)add(p.yearFrom,i=>`c.year >= $${i}`);
  if(p.yearTo!=null)add(p.yearTo,i=>`c.year <= $${i}`);
  if(p.genres.length){
    params.push(p.genres);const i=params.length;
    if(p.genreMode==='all')w.push(`(SELECT count(DISTINCT g.name_es) FROM movie_genres_canonical mgc JOIN genres g ON g.id=mgc.genre_id WHERE mgc.imdb_id=c.imdb_id AND g.name_es=ANY($${i}::text[]))=${p.genres.length}`);
    else w.push(`EXISTS(SELECT 1 FROM movie_genres_canonical mgc JOIN genres g ON g.id=mgc.genre_id WHERE mgc.imdb_id=c.imdb_id AND g.name_es=ANY($${i}::text[]))`);
  }
  return w.join(' AND ');
}

function orderSql(p){
  const t=`translate(lower(COALESCE(c.display_title,'')),'áéíóúüñ','aeiouun')`;
  if(p.sort==='year')return `c.year ${p.dir.toUpperCase()} NULLS LAST,c.final_rating DESC NULLS LAST,${t} ASC,c.imdb_id ASC`;
  if(p.sort==='title')return `${t} ${p.dir.toUpperCase()},c.year DESC NULLS LAST,c.imdb_id ASC`;
  return `c.final_rating ${p.dir.toUpperCase()} NULLS LAST,c.year DESC NULLS LAST,${t} ASC,c.imdb_id ASC`;
}

const baseSql=`FROM catalog_read_model c
LEFT JOIN plex_catalog_status pcs ON pcs.imdb_id=c.imdb_id AND pcs.status='in_plex'
LEFT JOIN plex_technical_state pts ON pts.rating_key=pcs.rating_key AND pts.snapshot_status='ready' AND pts.technical_fingerprint IS NOT NULL
LEFT JOIN piko_quality pq ON pq.rating_key=pcs.rating_key AND pq.status='evaluated' AND pq.formula_version=$1 AND pq.source_fingerprint IS NOT DISTINCT FROM pts.technical_fingerprint
LEFT JOIN piko_quality_aggregates pqa ON pqa.entity_type='show' AND pqa.entity_key=pcs.rating_key AND pqa.formula_version=$1`;

export async function getCatalogV4(raw={}){
  const p=parseCatalogV4(raw);if(p.invalidYearRange)return{state:p,rows:[],summary:{total:0,in_plex:0,without_plex:0},pageCount:1,page:1};
  const sql=db(),params=[PIKOQUALITY_ACTIVE_VERSION],where=whereSql(p,params),order=orderSql(p);
  const [summary]=await sql.query(`SELECT count(*)::int total,count(*) FILTER(WHERE c.effective_status='in_plex')::int in_plex,count(*) FILTER(WHERE c.effective_status<>'in_plex')::int without_plex ${baseSql} WHERE ${where}`,params);
  const total=Number(summary?.total||0),pageCount=Math.max(1,Math.ceil(total/CATALOG_V4_PAGE_SIZE)),page=Math.min(p.page,pageCount),offset=(page-1)*CATALOG_V4_PAGE_SIZE;
  const rows=await sql.query(`SELECT c.imdb_id,c.display_title,c.original_title,c.year,c.type,c.poster_path,c.final_rating,c.effective_status,CASE WHEN c.effective_status<>'in_plex' THEN NULL WHEN c.type='Película' THEN pq.score/10.0 ELSE pqa.score/10.0 END pikoquality,COALESCE((SELECT array_agg(g.name_es ORDER BY g.name_es) FROM movie_genres_canonical mgc JOIN genres g ON g.id=mgc.genre_id WHERE mgc.imdb_id=c.imdb_id),c.genres,'{}'::text[]) genres ${baseSql} WHERE ${where} ORDER BY ${order} LIMIT ${CATALOG_V4_PAGE_SIZE} OFFSET ${offset}`,params);
  return{state:{...p,page},rows,summary:summary||{total:0,in_plex:0,without_plex:0},pageCount,page};
}

export async function getCatalogV4Genres(){const sql=db();const rows=await sql`SELECT name_es value FROM genres WHERE COALESCE(name_es,'')<>'' ORDER BY name_es`;return rows.map(r=>r.value)}
