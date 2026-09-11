import {recomputeLifecycleWithSql} from './lifecycle-recompute-core.mjs';

export async function recomputeLifecycleForPikoQualityRatingKeys(sql,ratingKeys=[]){
  const keys=[...new Set((ratingKeys||[]).map(String).filter(Boolean))];
  if(!keys.length)return new Map();
  const rows=await sql`
    SELECT DISTINCT imdb_id FROM (
      SELECT pcs.imdb_id
      FROM plex_catalog_status pcs
      WHERE pcs.rating_key=ANY(${keys}::text[]) AND pcs.imdb_id IS NOT NULL
      UNION
      SELECT sr.imdb_id
      FROM plex_items p
      JOIN series_reference sr ON sr.show_rating_key=p.grandparent_rating_key
      WHERE p.rating_key=ANY(${keys}::text[]) AND p.item_type='episode' AND sr.imdb_id IS NOT NULL
    ) x
    WHERE imdb_id~'^tt[0-9]+$'`;
  return recomputeLifecycleWithSql(sql,rows.map(r=>r.imdb_id));
}
