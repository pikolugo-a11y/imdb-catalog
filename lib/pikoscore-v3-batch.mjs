import {computePikoScoreV3,PIKOSCORE_V3_VERSION} from './pikoscore-v3-core.mjs';

export async function calculateAndSavePikoScoreV3WithSql(sql,imdbId,{trace=null}={}){
  const[row]=await sql`SELECT m.imdb_id,m.country,m.year,m.final_rating,m.pikoscore_version,m.pikoscore_confidence,m.ratings_refreshed_at,mm.release_date FROM movies m LEFT JOIN movie_metadata mm USING(imdb_id) WHERE m.imdb_id=${imdbId} LIMIT 1`;
  if(!row)throw Object.assign(new Error(`Título no encontrado: ${imdbId}`),{permanent:true});
  const ratings=await sql`SELECT source,normalized_rating,votes,status,provider FROM title_ratings WHERE imdb_id=${imdbId} ORDER BY source`;
  await trace?.event?.({eventType:'step_started',step:'pikoscore_v3',message:'Calculando PikoScore 3.0 con ratings persistidos'});
  const result=computePikoScoreV3({ratings,country:row.country,year:row.year,release_date:row.release_date});
  await sql`UPDATE movies SET final_rating=${result.score},pikoscore_calculated_at=now(),pikoscore_version=${PIKOSCORE_V3_VERSION},pikoscore_confidence=${result.confidence},synced_at=now() WHERE imdb_id=${imdbId}`;
  await trace?.event?.({eventType:'step_completed',step:'pikoscore_v3',message:'PikoScore 3.0 calculado y guardado',data:{score:result.score,confidence:result.confidence,version:PIKOSCORE_V3_VERSION,source_count:result.sourceCount,family_count:result.familyCount}});
  return{...result,version:PIKOSCORE_V3_VERSION,previous:{score:row.final_rating==null?null:Number(row.final_rating),version:row.pikoscore_version||null,confidence:row.pikoscore_confidence==null?null:Number(row.pikoscore_confidence)},ratingsRefreshedAt:row.ratings_refreshed_at||null};
}
