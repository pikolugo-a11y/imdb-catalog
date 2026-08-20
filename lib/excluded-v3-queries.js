import 'server-only';
import {db} from './db';

const movieType='Película';
const seriesTypes=['Serie','Miniserie'];
const SORTS=new Set(['newest','oldest','title','year_desc','year_asc']);

function validDate(v){const s=String(v||'').trim();return /^\d{4}-\d{2}-\d{2}$/.test(s)?s:null}
function parse(filters={}){
  const q=String(filters.q||'').trim().toLowerCase();
  const type=String(filters.type||'');
  const reason=String(filters.reason||'').trim().toLowerCase();
  const sort=SORTS.has(String(filters.sort||''))?String(filters.sort):'newest';
  const from=validDate(filters.from);
  const to=validDate(filters.to);
  const page=Math.max(1,Number.parseInt(filters.page,10)||1);
  const view=filters.view==='list'?'list':'grid';
  const pageSize=view==='list'?50:42;
  return{q,type,reason,sort,from,to,page,pageSize};
}

function candidateTypeSql(sql){return sql`CASE WHEN c.candidate_type='movie' THEN ${movieType} WHEN c.candidate_type='tvMiniSeries' THEN 'Miniserie' WHEN c.candidate_type='tvSeries' THEN 'Serie' ELSE NULL END`}
function displayTitleSql(sql){return sql`COALESCE(m.title_es,m.title,m.original_title,c.source_snapshot->>'title',c.source_snapshot->>'originalTitle',e.imdb_id)`}
function originalTitleSql(sql){return sql`COALESCE(m.original_title,c.source_snapshot->>'originalTitle')`}
function effectiveTypeSql(sql){return sql`COALESCE(m.type,CASE WHEN c.candidate_type='movie' THEN ${movieType} WHEN c.candidate_type='tvMiniSeries' THEN 'Miniserie' WHEN c.candidate_type='tvSeries' THEN 'Serie' ELSE NULL END)`}
function effectiveYearSql(sql){return sql`COALESCE(m.year,c.year)`}

function where(sql,{q,type,reason,from,to}){
  const displayTitle=displayTitleSql(sql);
  const originalTitle=originalTitleSql(sql);
  const effectiveType=effectiveTypeSql(sql);
  return sql`
    WHERE (${q}='' OR lower(${displayTitle}) LIKE ${'%'+q+'%'} OR lower(COALESCE(${originalTitle},'')) LIKE ${'%'+q+'%'} OR lower(e.imdb_id) LIKE ${'%'+q+'%'})
      AND (${type}='' OR (${type}='movie' AND ${effectiveType}=${movieType}) OR (${type}='series' AND ${effectiveType}=ANY(${seriesTypes})))
      AND (${reason}='' OR lower(COALESCE(e.reason,'')) LIKE ${'%'+reason+'%'})
      AND (${from}::date IS NULL OR e.excluded_at::date>=${from}::date)
      AND (${to}::date IS NULL OR e.excluded_at::date<=${to}::date)
  `;
}

export async function getExcludedV3(filters={}){
  const sql=db();
  const p=parse(filters);
  const offset=(p.page-1)*p.pageSize;
  const displayTitle=displayTitleSql(sql);
  const originalTitle=originalTitleSql(sql);
  const effectiveType=effectiveTypeSql(sql);
  const effectiveYear=effectiveYearSql(sql);
  return sql`
    SELECT e.imdb_id,
      ${displayTitle} display_title,
      ${originalTitle} original_title,
      ${effectiveYear} year,
      ${effectiveType} type,
      m.poster_path,
      COALESCE(m.imdb_rating,c.imdb_rating) imdb_rating,
      COALESCE(m.imdb_votes,c.imdb_votes) imdb_votes,
      m.final_rating,
      e.reason,e.excluded_at,e.excluded_by,
      (m.imdb_id IS NOT NULL) in_catalog,
      (c.imdb_id IS NOT NULL) in_candidates
    FROM catalog_exclusions e
    LEFT JOIN movies m USING(imdb_id)
    LEFT JOIN catalog_candidates c USING(imdb_id)
    ${where(sql,p)}
    ORDER BY
      CASE WHEN ${p.sort}='newest' THEN e.excluded_at END DESC NULLS LAST,
      CASE WHEN ${p.sort}='oldest' THEN e.excluded_at END ASC NULLS LAST,
      CASE WHEN ${p.sort}='title' THEN lower(${displayTitle}) END ASC NULLS LAST,
      CASE WHEN ${p.sort}='year_desc' THEN ${effectiveYear} END DESC NULLS LAST,
      CASE WHEN ${p.sort}='year_asc' THEN ${effectiveYear} END ASC NULLS LAST,
      e.excluded_at DESC NULLS LAST,e.imdb_id
    LIMIT ${p.pageSize} OFFSET ${offset}
  `;
}

export async function getExcludedStatsV3(filters={}){
  const sql=db();
  const p=parse(filters);
  const effectiveType=effectiveTypeSql(sql);
  const [row]=await sql`
    SELECT count(*)::int total,
      count(*) FILTER(WHERE ${effectiveType}=${movieType})::int movies,
      count(*) FILTER(WHERE ${effectiveType}=ANY(${seriesTypes}))::int series,
      count(*) FILTER(WHERE e.excluded_at>=now()-interval '30 days')::int last30
    FROM catalog_exclusions e
    LEFT JOIN movies m USING(imdb_id)
    LEFT JOIN catalog_candidates c USING(imdb_id)
    ${where(sql,p)}
  `;
  return row||{total:0,movies:0,series:0,last30:0};
}

export async function getExcludedFiltersV3(){
  const sql=db();
  const reasons=await sql`SELECT DISTINCT reason FROM catalog_exclusions WHERE COALESCE(reason,'')<>'' ORDER BY reason`;
  return{reasons:reasons.map(x=>x.reason)};
}

export function excludedPageSize(view){return view==='list'?50:42}
