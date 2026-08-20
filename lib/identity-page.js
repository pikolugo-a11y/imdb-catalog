import 'server-only';
import {db} from './db';

const clampPage=n=>Math.max(1,Number(n)||1),clampSize=n=>Math.min(100,Math.max(20,Number(n)||50));
function filtersSql(sql,{type,q,issue}){return sql`ex.imdb_id IS NULL AND (
  m.imdb_id IS NULL OR m.imdb_id!~'^tt[0-9]+$' OR m.tmdb_id IS NULL OR m.fa_id IS NULL OR
  COALESCE((m.source_status->>'tmdb'),'')='mismatch' OR COALESCE((m.source_status->>'filmaffinity'),'')='mismatch' OR
  COALESCE((m.source_status->>'identity_refresh_state'),'') IN ('pending','failed')
) AND (${type}='' OR (${type}='movie' AND m.type='Película') OR (${type}='series' AND m.type IN ('Serie','Miniserie'))) AND (${q}='' OR lower(COALESCE(m.title_es,m.title,m.original_title,'')) LIKE ${'%'+q+'%'}) AND (
  ${issue}='' OR (${issue}='missing_tmdb' AND m.tmdb_id IS NULL) OR (${issue}='missing_fa' AND m.fa_id IS NULL) OR
  (${issue}='doubtful' AND (COALESCE((m.source_status->>'tmdb'),'')='mismatch' OR COALESCE((m.source_status->>'filmaffinity'),'')='mismatch')) OR
  (${issue}='pending_refresh' AND COALESCE((m.source_status->>'identity_refresh_state'),'')='pending') OR
  (${issue}='refresh_failed' AND COALESCE((m.source_status->>'identity_refresh_state'),'')='failed')
)`}
export async function getIdentityCatalogPage(filters={}){
  const sql=db(),page=clampPage(filters.page),pageSize=clampSize(filters.pageSize),offset=(page-1)*pageSize,type=String(filters.type||''),q=String(filters.q||'').trim().toLowerCase(),issue=String(filters.issue||''),where=filtersSql(sql,{type,q,issue});
  const [countRows,rows]=await Promise.all([
    sql`SELECT count(*)::int total FROM movies m LEFT JOIN catalog_exclusions ex USING(imdb_id) WHERE ${where}`,
    sql`SELECT m.imdb_id,m.type,COALESCE(m.title_es,m.title,m.original_title) AS display_title,m.original_title,m.year,m.tmdb_id,m.fa_id,m.source_status,
      (m.imdb_id IS NULL OR m.imdb_id!~'^tt[0-9]+$') AS missing_imdb,(m.tmdb_id IS NULL) AS missing_tmdb,(m.fa_id IS NULL) AS missing_fa,
      (COALESCE((m.source_status->>'tmdb'),'')='mismatch' OR COALESCE((m.source_status->>'filmaffinity'),'')='mismatch') AS doubtful,
      (m.imdb_id~'^tt[0-9]+$' AND m.tmdb_id IS NOT NULL AND m.fa_id IS NOT NULL) AS identity_complete,
      COALESCE(m.source_status->>'identity_refresh_state','') AS refresh_state,m.source_status->>'identity_refreshed_at' AS identity_refreshed_at,m.source_status->>'identity_refresh_error' AS identity_refresh_error
      FROM movies m LEFT JOIN catalog_exclusions ex USING(imdb_id) WHERE ${where}
      ORDER BY CASE WHEN COALESCE(m.source_status->>'identity_refresh_state','')='failed' THEN 0 WHEN COALESCE(m.source_status->>'identity_refresh_state','')='pending' THEN 1 WHEN m.tmdb_id IS NULL AND m.fa_id IS NULL THEN 2 WHEN m.tmdb_id IS NULL THEN 3 WHEN m.fa_id IS NULL THEN 4 ELSE 5 END,m.year DESC NULLS LAST,m.imdb_id LIMIT ${pageSize} OFFSET ${offset}`
  ]);
  const total=Number(countRows[0]?.total||0);return{rows,total,page,pageSize,pages:Math.max(1,Math.ceil(total/pageSize))}
}

export async function getIdentityWorkflowStats(){const sql=db();const[r]=await sql`SELECT
 count(*) FILTER(WHERE m.imdb_id IS NULL OR m.imdb_id!~'^tt[0-9]+$' OR m.tmdb_id IS NULL OR m.fa_id IS NULL OR COALESCE(m.source_status->>'identity_refresh_state','') IN ('pending','failed'))::int AS affected_catalog,
 count(*) FILTER(WHERE m.tmdb_id IS NULL)::int AS missing_tmdb,
 count(*) FILTER(WHERE m.fa_id IS NULL)::int AS missing_fa,
 count(*) FILTER(WHERE COALESCE(m.source_status->>'identity_refresh_state','')='pending')::int AS pending_refresh,
 count(*) FILTER(WHERE COALESCE(m.source_status->>'identity_refresh_state','')='failed')::int AS refresh_failed,
 count(*) FILTER(WHERE COALESCE((m.source_status->>'tmdb'),'')='mismatch' OR COALESCE((m.source_status->>'filmaffinity'),'')='mismatch')::int AS doubtful
 FROM movies m LEFT JOIN catalog_exclusions ex USING(imdb_id) WHERE ex.imdb_id IS NULL`;
 const[p]=await sql`SELECT count(*)::int AS missing_plex_imdb FROM plex_items x WHERE x.active AND x.item_type IN('movie','show') AND NOT EXISTS(SELECT 1 FROM plex_external_ids i WHERE i.rating_key=x.rating_key AND i.provider='imdb')`;
 return{...r,...p,affected_total:Number(r.affected_catalog||0)+Number(p.missing_plex_imdb||0)}}

export async function getPlexIdentityPage(filters={}){const sql=db(),page=clampPage(filters.page),pageSize=clampSize(filters.pageSize),offset=(page-1)*pageSize,q=String(filters.q||'').trim().toLowerCase();const [countRows,rows]=await Promise.all([sql`SELECT count(*)::int AS total FROM plex_items p WHERE p.active AND p.item_type IN('movie','show') AND NOT EXISTS(SELECT 1 FROM plex_external_ids i WHERE i.rating_key=p.rating_key AND i.provider='imdb') AND (${q}='' OR lower(COALESCE(p.plex_title,'')) LIKE ${'%'+q+'%'})`,sql`SELECT p.rating_key,p.plex_title AS display_title,p.plex_year AS year,p.item_type,max(x.external_id) FILTER(WHERE x.provider='tmdb') AS tmdb_id,max(x.external_id) FILTER(WHERE x.provider IN('filmaffinity','fa')) AS fa_id,array_agg(x.provider||':'||x.external_id) FILTER(WHERE x.provider IS NOT NULL) AS known_ids FROM plex_items p LEFT JOIN plex_external_ids x ON x.rating_key=p.rating_key WHERE p.active AND p.item_type IN('movie','show') AND NOT EXISTS(SELECT 1 FROM plex_external_ids i WHERE i.rating_key=p.rating_key AND i.provider='imdb') AND (${q}='' OR lower(COALESCE(p.plex_title,'')) LIKE ${'%'+q+'%'}) GROUP BY p.rating_key,p.plex_title,p.plex_year,p.item_type,p.added_at ORDER BY p.added_at DESC NULLS LAST LIMIT ${pageSize} OFFSET ${offset}`]);const total=Number(countRows[0]?.total||0);return{rows,total,page,pageSize,pages:Math.max(1,Math.ceil(total/pageSize))}}
