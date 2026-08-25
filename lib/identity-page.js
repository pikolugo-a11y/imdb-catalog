import 'server-only';
import {db} from './db';

const clampPage=n=>Math.max(1,Number(n)||1),clampSize=n=>Math.min(100,Math.max(20,Number(n)||50));

export async function getIdentityCatalogPage(filters={}){
  const sql=db(),page=clampPage(filters.page),pageSize=clampSize(filters.pageSize),offset=(page-1)*pageSize,type=String(filters.type||''),q=String(filters.q||'').trim().toLowerCase();
  const where=sql`cl.lifecycle_state='IDENTITY_PENDING'
    AND m.tmdb_id IS NULL
    AND ex.imdb_id IS NULL
    AND (${type}='' OR (${type}='movie' AND m.type='Película') OR (${type}='series' AND m.type IN ('Serie','Miniserie')))
    AND (${q}='' OR lower(COALESCE(m.title_es,m.title,m.original_title,'')) LIKE ${'%'+q+'%'})`;
  const [countRows,rows]=await Promise.all([
    sql`SELECT count(*)::int total FROM catalog_lifecycle cl JOIN movies m USING(imdb_id) LEFT JOIN catalog_exclusions ex USING(imdb_id) WHERE ${where}`,
    sql`SELECT m.imdb_id,m.type,COALESCE(m.title_es,m.title,m.original_title) AS display_title,m.original_title,m.year,m.tmdb_id,
      (m.tmdb_id IS NULL) AS missing_tmdb,cl.blocking_reason
      FROM catalog_lifecycle cl JOIN movies m USING(imdb_id) LEFT JOIN catalog_exclusions ex USING(imdb_id)
      WHERE ${where}
      ORDER BY m.year DESC NULLS LAST,m.imdb_id
      LIMIT ${pageSize} OFFSET ${offset}`
  ]);
  const total=Number(countRows[0]?.total||0);return{rows,total,page,pageSize,pages:Math.max(1,Math.ceil(total/pageSize))};
}

export async function getIdentityWorkflowStats(){
  const sql=db();
  const[r]=await sql`SELECT
    count(*)::int affected_catalog,
    count(*) FILTER(WHERE m.tmdb_id IS NULL)::int missing_tmdb,
    count(*) FILTER(WHERE m.type='Película')::int movies,
    count(*) FILTER(WHERE m.type IN('Serie','Miniserie'))::int series
    FROM catalog_lifecycle cl JOIN movies m USING(imdb_id)
    LEFT JOIN catalog_exclusions ex USING(imdb_id)
    WHERE cl.lifecycle_state='IDENTITY_PENDING' AND m.tmdb_id IS NULL AND ex.imdb_id IS NULL`;
  return r||{affected_catalog:0,missing_tmdb:0,movies:0,series:0};
}
