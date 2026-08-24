import 'server-only';
import {db} from './db';

export async function getSagaPikoScores(){
  const sql=db();
  const rows=await sql`
    SELECT sm.tmdb_collection_id,
           round(avg(c.final_rating)::numeric,2) AS avg_pikoscore,
           count(c.final_rating)::int AS scored_count
    FROM saga_collection_members sm
    LEFT JOIN catalog_read_model c ON c.imdb_id=sm.imdb_id
    LEFT JOIN catalog_exclusions ex ON ex.imdb_id=sm.imdb_id
    LEFT JOIN identity_validation iv ON iv.imdb_id=sm.imdb_id
    WHERE ex.imdb_id IS NULL
      AND (sm.imdb_id IS NULL OR iv.validation_status='valid')
      AND c.final_rating IS NOT NULL
    GROUP BY sm.tmdb_collection_id`;
  return new Map(rows.map(r=>[String(r.tmdb_collection_id),{score:r.avg_pikoscore==null?null:Number(r.avg_pikoscore),count:Number(r.scored_count||0)}]));
}
