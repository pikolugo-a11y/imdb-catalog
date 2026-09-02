import 'server-only';
import {db} from './db';

const seriesTypes=['Serie','Miniserie'];
const SORTS=new Set(['newest','oldest','title','year_desc','year_asc']);

function validDate(v){const s=String(v||'').trim();return /^\d{4}-\d{2}-\d{2}$/.test(s)?s:null}
function parse(filters={}){const q=String(filters.q||'').trim().toLowerCase(),type=String(filters.type||''),reason=String(filters.reason||'').trim().toLowerCase(),sort=SORTS.has(String(filters.sort||''))?String(filters.sort):'newest',from=validDate(filters.from),to=validDate(filters.to),page=Math.max(1,Number.parseInt(filters.page,10)||1),view=filters.view==='list'?'list':'grid',pageSize=view==='list'?50:42;return{q,type,reason,sort,from,to,page,pageSize}}

export async function getExcludedV3(filters={}){const sql=db(),p=parse(filters),offset=(p.page-1)*p.pageSize;return sql`
WITH x AS (
 SELECT e.imdb_id,
 COALESCE(m.title_es,m.title,m.original_title,c.source_snapshot->>'title',c.source_snapshot->>'originalTitle',e.imdb_id) AS display_title,
 COALESCE(m.original_title,c.source_snapshot->>'originalTitle') AS original_title,
 COALESCE(m.year,c.year) AS item_year,
 COALESCE(m.type,CASE WHEN c.candidate_type='movie' THEN 'Película' WHEN c.candidate_type='tvMiniSeries' THEN 'Miniserie' WHEN c.candidate_type='tvSeries' THEN 'Serie' ELSE NULL END) AS item_type,
 COALESCE(m.poster_path,c.source_snapshot->>'posterPath') AS poster_path,
 COALESCE(ir.rating,c.imdb_rating) AS imdb_rating,
 COALESCE(ir.votes,c.imdb_votes) AS imdb_votes,
 m.final_rating,e.reason,e.excluded_at,e.excluded_by,(m.imdb_id IS NOT NULL) AS in_catalog,(c.imdb_id IS NOT NULL) AS in_candidates
 FROM catalog_exclusions e LEFT JOIN movies m USING(imdb_id) LEFT JOIN catalog_candidates c USING(imdb_id)
 LEFT JOIN LATERAL (SELECT tr.rating,tr.votes FROM title_ratings tr WHERE tr.imdb_id=e.imdb_id AND lower(tr.provider)='imdb' ORDER BY tr.fetched_at DESC NULLS LAST LIMIT 1) ir ON true
)
SELECT imdb_id,display_title,original_title,item_year AS year,item_type AS type,poster_path,imdb_rating,imdb_votes,final_rating,reason,excluded_at,excluded_by,in_catalog,in_candidates FROM x
WHERE (${p.q}='' OR lower(COALESCE(display_title,'')) LIKE ${'%'+p.q+'%'} OR lower(COALESCE(original_title,'')) LIKE ${'%'+p.q+'%'} OR lower(imdb_id) LIKE ${'%'+p.q+'%'})
AND (${p.type}='' OR (${p.type}='movie' AND item_type='Película') OR (${p.type}='series' AND item_type=ANY(${seriesTypes})))
AND (${p.reason}='' OR lower(COALESCE(reason,'')) LIKE ${'%'+p.reason+'%'}) AND (${p.from}::date IS NULL OR excluded_at::date>=${p.from}::date) AND (${p.to}::date IS NULL OR excluded_at::date<=${p.to}::date)
ORDER BY CASE WHEN ${p.sort}='newest' THEN excluded_at END DESC NULLS LAST,CASE WHEN ${p.sort}='oldest' THEN excluded_at END ASC NULLS LAST,CASE WHEN ${p.sort}='title' THEN lower(display_title) END ASC NULLS LAST,CASE WHEN ${p.sort}='year_desc' THEN item_year END DESC NULLS LAST,CASE WHEN ${p.sort}='year_asc' THEN item_year END ASC NULLS LAST,excluded_at DESC NULLS LAST,imdb_id LIMIT ${p.pageSize} OFFSET ${offset}`}

export async function getExcludedStatsV3(filters={}){const sql=db(),p=parse(filters);const[row]=await sql`WITH x AS (SELECT e.imdb_id,COALESCE(m.title_es,m.title,m.original_title,c.source_snapshot->>'title',c.source_snapshot->>'originalTitle',e.imdb_id) AS display_title,COALESCE(m.original_title,c.source_snapshot->>'originalTitle') AS original_title,COALESCE(m.type,CASE WHEN c.candidate_type='movie' THEN 'Película' WHEN c.candidate_type='tvMiniSeries' THEN 'Miniserie' WHEN c.candidate_type='tvSeries' THEN 'Serie' ELSE NULL END) AS item_type,e.reason,e.excluded_at FROM catalog_exclusions e LEFT JOIN movies m USING(imdb_id) LEFT JOIN catalog_candidates c USING(imdb_id)) SELECT count(*)::int AS total,count(*) FILTER(WHERE item_type='Película')::int AS movies,count(*) FILTER(WHERE item_type=ANY(${seriesTypes}))::int AS series,count(*) FILTER(WHERE excluded_at>=now()-interval '30 days')::int AS last30 FROM x WHERE (${p.q}='' OR lower(COALESCE(display_title,'')) LIKE ${'%'+p.q+'%'} OR lower(COALESCE(original_title,'')) LIKE ${'%'+p.q+'%'} OR lower(imdb_id) LIKE ${'%'+p.q+'%'}) AND (${p.type}='' OR (${p.type}='movie' AND item_type='Película') OR (${p.type}='series' AND item_type=ANY(${seriesTypes}))) AND (${p.reason}='' OR lower(COALESCE(reason,'')) LIKE ${'%'+p.reason+'%'}) AND (${p.from}::date IS NULL OR excluded_at::date>=${p.from}::date) AND (${p.to}::date IS NULL OR excluded_at::date<=${p.to}::date)`;return row||{total:0,movies:0,series:0,last30:0}}
export async function getExcludedFiltersV3(){const sql=db(),reasons=await sql`SELECT DISTINCT reason FROM catalog_exclusions WHERE COALESCE(reason,'')<>'' ORDER BY reason`;return{reasons:reasons.map(x=>x.reason)}}
export function excludedPageSize(view){return view==='list'?50:42}
