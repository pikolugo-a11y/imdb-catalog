import 'server-only';
import {db} from './db';
import {getTitleRatings} from './title-ratings';
import {computePikoScoreV3,PIKOSCORE_V3_VERSION} from './pikoscore-v3-core.mjs';

export async function evaluatePikoScoreV3ForTitle(imdbId){
  if(!/^tt\d+$/.test(String(imdbId||'')))throw new Error('IMDb ID inválido');
  const sql=db();
  const [row]=await sql`
    SELECT m.imdb_id,m.title_es,m.original_title,m.country,m.year,m.final_rating,
           m.pikoscore_version,m.pikoscore_confidence,mm.release_date
    FROM movies m
    LEFT JOIN movie_metadata mm USING(imdb_id)
    WHERE m.imdb_id=${imdbId}
    LIMIT 1
  `;
  if(!row)throw new Error('Título no encontrado');
  const ratings=await getTitleRatings(imdbId);
  const result=computePikoScoreV3({ratings,country:row.country,year:row.year,release_date:row.release_date});
  return{imdbId,title:row.title_es||row.original_title||imdbId,experimental:true,version:PIKOSCORE_V3_VERSION,legacy:{score:row.final_rating==null?null:Number(row.final_rating),version:row.pikoscore_version||null,confidence:row.pikoscore_confidence==null?null:Number(row.pikoscore_confidence)},...result};
}
