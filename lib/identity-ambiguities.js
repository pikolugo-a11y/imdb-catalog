import 'server-only';
import {db} from './db';

const clampPage=n=>Math.max(1,Number(n)||1),clampSize=n=>Math.min(100,Math.max(20,Number(n)||50));

export async function getIdentityAmbiguities({q='',page=1,pageSize=50}={}){
  const sql=db(),p=clampPage(page),size=clampSize(pageSize),offset=(p-1)*size,term=String(q||'').trim().toLowerCase();
  const where=sql`ex.imdb_id IS NULL AND m.fa_id IS NULL AND COALESCE(m.source_status->'fa_search'->>'status','')='ambiguous' AND (${term}='' OR lower(COALESCE(m.title_es,m.title,m.original_title,'')) LIKE ${'%'+term+'%'})`;
  const [countRows,rows]=await Promise.all([
    sql`SELECT count(*)::int total FROM movies m LEFT JOIN catalog_exclusions ex USING(imdb_id) WHERE ${where}`,
    sql`SELECT m.imdb_id,m.type,COALESCE(m.title_es,m.title,m.original_title) display_title,m.original_title,m.year,m.tmdb_id,
      m.source_status->'fa_search' AS fa_search
      FROM movies m LEFT JOIN catalog_exclusions ex USING(imdb_id)
      WHERE ${where}
      ORDER BY COALESCE((m.source_status->'fa_search'->>'confidence')::numeric,0) DESC,m.year DESC NULLS LAST,m.imdb_id
      LIMIT ${size} OFFSET ${offset}`
  ]);
  const normalized=rows.map(r=>{const s=r.fa_search||{};return {...r,confidence:Number(s.confidence||0),margin:Number(s.margin||0),best_fa_id:s.best_fa_id||null,attempted_at:s.attempted_at||null,candidates:Array.isArray(s.candidates)?s.candidates:[]}});
  const total=Number(countRows[0]?.total||0);return{rows:normalized,total,page:p,pageSize:size,pages:Math.max(1,Math.ceil(total/size))};
}

export async function getIdentityAmbiguityStats(){const sql=db();const[r]=await sql`SELECT
 count(*) FILTER(WHERE m.fa_id IS NULL AND COALESCE(m.source_status->'fa_search'->>'status','')='ambiguous')::int AS ambiguous,
 count(*) FILTER(WHERE m.fa_id IS NULL AND COALESCE(m.source_status->'fa_search'->>'status','')='not_found')::int AS not_found,
 count(*) FILTER(WHERE m.fa_id IS NULL AND COALESCE(m.source_status->'fa_search'->>'status','') IN ('ambiguous','not_found'))::int AS skipped_next_run
 FROM movies m LEFT JOIN catalog_exclusions ex USING(imdb_id) WHERE ex.imdb_id IS NULL`;return r||{ambiguous:0,not_found:0,skipped_next_run:0}}
