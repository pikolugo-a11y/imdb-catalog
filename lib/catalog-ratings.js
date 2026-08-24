import 'server-only';
import {db} from './db';

export async function getCatalogRatings(imdbId){
  const sql=db();
  const [ratings,rows,events]=await Promise.all([
    sql`SELECT source,normalized_rating,votes,rating_type,provider,fetched_at
        FROM title_ratings
        WHERE imdb_id=${imdbId} AND status='available' AND normalized_rating>0
        ORDER BY CASE source
          WHEN 'imdb' THEN 1 WHEN 'letterboxd' THEN 2 WHEN 'tmdb' THEN 3 WHEN 'trakt' THEN 4
          WHEN 'rt_audience' THEN 5 WHEN 'metacritic_user' THEN 6 WHEN 'rt_critics' THEN 7
          WHEN 'metacritic' THEN 8 WHEN 'roger_ebert' THEN 9 ELSE 20 END,source`,
    sql`SELECT final_rating,pikoscore_confidence,pikoscore_version,pikoscore_calculated_at,ratings_refreshed_at
        FROM movies WHERE imdb_id=${imdbId} LIMIT 1`,
    sql`SELECT payload,created_at FROM admin_events
        WHERE event_type='pikoscore' AND entity_type='title' AND entity_id=${imdbId} AND action='calculated_v3'
        ORDER BY created_at DESC LIMIT 1`
  ]);
  const row=rows[0]||{};
  const event=events[0]||null;
  const payload=event?.payload&&typeof event.payload==='object'?event.payload:{};
  return{
    ratings,
    score:row.final_rating??null,
    confidence:row.pikoscore_confidence==null?null:Number(row.pikoscore_confidence),
    version:row.pikoscore_version||null,
    calculatedAt:row.pikoscore_calculated_at||null,
    refreshedAt:row.ratings_refreshed_at||null,
    sourceCount:Number(payload.source_count??ratings.length??0),
    familyCount:Number(payload.family_count??payload.contributions?.length??0),
    familyCoverage:payload.family_coverage==null?null:Number(payload.family_coverage),
    market:payload.market||null,
    contributions:Array.isArray(payload.contributions)?payload.contributions:[]
  };
}
