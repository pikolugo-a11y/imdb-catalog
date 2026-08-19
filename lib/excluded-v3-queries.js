import 'server-only';
import {db} from './db';

const movieType='Película';
const seriesTypes=['Serie','Miniserie'];
const SORTS=new Set(['newest','oldest','title','year_desc','year_asc']);

function parse(filters={}){
  const q=String(filters.q||'').trim().toLowerCase();
  const type=String(filters.type||'');
  const reason=String(filters.reason||'').trim().toLowerCase();
  const sort=SORTS.has(String(filters.sort||''))?String(filters.sort):'newest';
  const from=String(filters.from||'').trim();
  const to=String(filters.to||'').trim();
  const page=Math.max(1,Number.parseInt(filters.page,10)||1);
  const view=filters.view==='list'?'list':'grid';
  const pageSize=view==='list'?50:42;
  return{q,type,reason,sort,from,to,page,pageSize};
}

function where(sql,{q,type,reason,from,to}){
  return sql`
    WHERE (${q}='' OR lower(COALESCE(m.title_es,m.title,m.original_title,'')) LIKE ${'%'+q+'%'} OR lower(COALESCE(m.original_title,'')) LIKE ${'%'+q+'%'} OR lower(m.imdb_id) LIKE ${'%'+q+'%'})
      AND (${type}='' OR (${type}='movie' AND m.type=${movieType}) OR (${type}='series' AND m.type=ANY(${seriesTypes})))
      AND (${reason}='' OR lower(COALESCE(e.reason,'')) LIKE ${'%'+reason+'%'})
      AND (${from}='' OR e.excluded_at::date>=${from}::date)
      AND (${to}='' OR e.excluded_at::date<=${to}::date)
  `;
}

export async function getExcludedV3(filters={}){
  const sql=db();
  const p=parse(filters);
  const offset=(p.page-1)*p.pageSize;
  return sql`
    SELECT m.imdb_id,COALESCE(m.title_es,m.title,m.original_title) display_title,m.original_title,m.year,m.type,m.poster_path,m.imdb_rating,m.imdb_votes,m.final_rating,e.reason,e.excluded_at,e.excluded_by
    FROM catalog_exclusions e
    JOIN movies m USING(imdb_id)
    ${where(sql,p)}
    ORDER BY
      CASE WHEN ${p.sort}='newest' THEN e.excluded_at END DESC NULLS LAST,
      CASE WHEN ${p.sort}='oldest' THEN e.excluded_at END ASC NULLS LAST,
      CASE WHEN ${p.sort}='title' THEN lower(COALESCE(m.title_es,m.title,m.original_title)) END ASC NULLS LAST,
      CASE WHEN ${p.sort}='year_desc' THEN m.year END DESC NULLS LAST,
      CASE WHEN ${p.sort}='year_asc' THEN m.year END ASC NULLS LAST,
      e.excluded_at DESC NULLS LAST,m.imdb_id
    LIMIT ${p.pageSize} OFFSET ${offset}
  `;
}

export async function getExcludedStatsV3(filters={}){
  const sql=db();
  const p=parse(filters);
  const [row]=await sql`
    SELECT count(*)::int total,
      count(*) FILTER(WHERE m.type=${movieType})::int movies,
      count(*) FILTER(WHERE m.type=ANY(${seriesTypes}))::int series,
      count(*) FILTER(WHERE e.excluded_at>=now()-interval '30 days')::int last30
    FROM catalog_exclusions e
    JOIN movies m USING(imdb_id)
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
