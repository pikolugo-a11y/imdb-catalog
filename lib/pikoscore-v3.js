import 'server-only';
import {db} from './db';
import {audit} from './runlog';
import {getTitleRatings} from './title-ratings';
import {computePikoScoreV3,PIKOSCORE_V3_VERSION} from './pikoscore-v3-core.mjs';

export async function evaluatePikoScoreV3ForTitle(imdbId){
  if(!/^tt\d+$/.test(String(imdbId||'')))throw new Error('IMDb ID inválido');
  const sql=db();
  const [row]=await sql`
    SELECT m.imdb_id,m.title_es,m.original_title,m.country,m.year,m.final_rating,
           m.ratings_refreshed_at,m.pikoscore_calculated_at,m.pikoscore_version,m.pikoscore_confidence,mm.release_date
    FROM movies m
    LEFT JOIN movie_metadata mm USING(imdb_id)
    WHERE m.imdb_id=${imdbId}
    LIMIT 1
  `;
  if(!row)throw new Error('Título no encontrado');
  const ratings=await getTitleRatings(imdbId);
  const result=computePikoScoreV3({ratings,country:row.country,year:row.year,release_date:row.release_date});
  return{imdbId,title:row.title_es||row.original_title||imdbId,version:PIKOSCORE_V3_VERSION,previous:{score:row.final_rating==null?null:Number(row.final_rating),version:row.pikoscore_version||null,confidence:row.pikoscore_confidence==null?null:Number(row.pikoscore_confidence)},ratingsRefreshedAt:row.ratings_refreshed_at||null,...result};
}

export function isPikoScoreV3Due(row){
  if(!row?.pikoscore_calculated_at)return true;
  if(String(row?.pikoscore_version||'')!==PIKOSCORE_V3_VERSION)return true;
  const calc=new Date(row.pikoscore_calculated_at);
  if(Number.isNaN(calc.getTime()))return true;
  if(row.ratings_refreshed_at){const refreshed=new Date(row.ratings_refreshed_at);if(!Number.isNaN(refreshed.getTime())&&refreshed>calc)return true;}
  return false;
}

export async function calculateAndSavePikoScoreV3ForTitle(imdbId){
  const result=await evaluatePikoScoreV3ForTitle(imdbId),sql=db();
  await sql`
    UPDATE movies SET
      final_rating=${result.score},
      pikoscore_calculated_at=now(),
      pikoscore_version=${PIKOSCORE_V3_VERSION},
      pikoscore_confidence=${result.confidence},
      pikoscore_imdb_votes=NULL,
      pikoscore_fa_votes=NULL,
      pikoscore_tmdb_votes=NULL,
      pikoscore_critics_modifier=NULL,
      synced_at=now()
    WHERE imdb_id=${imdbId}
  `;
  await audit('pikoscore','title',imdbId,'calculated_v3',{
    version:PIKOSCORE_V3_VERSION,
    score:result.score,
    confidence:result.confidence,
    market:result.market,
    market_vote_scale:result.marketVoteScale,
    source_count:result.sourceCount,
    family_count:result.familyCount,
    family_coverage:result.familyCoverage,
    contributions:result.contributions,
    ratings_refreshed_at:result.ratingsRefreshedAt,
    previous:result.previous,
  });
  return result;
}
