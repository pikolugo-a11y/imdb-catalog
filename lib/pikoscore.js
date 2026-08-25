import 'server-only';
import {pikoScoreV3FreshnessDays,isPikoScoreV3Due,evaluatePikoScoreV3ForTitle,calculateAndSavePikoScoreV3ForTitle} from './pikoscore-v3';
import {PIKOSCORE_V3_VERSION,computePikoScoreV3} from './pikoscore-v3-core.mjs';

export const PIKOSCORE_VERSION=PIKOSCORE_V3_VERSION;
export const freshnessDays=pikoScoreV3FreshnessDays;
export const isPikoScoreDue=isPikoScoreV3Due;
export const computePikoScore=computePikoScoreV3;
export {evaluatePikoScoreV3ForTitle};
export const calculatePikoScoreForTitle=calculateAndSavePikoScoreV3ForTitle;

export function areRatingsFresh(row){
  if(!row?.ratings_refreshed_at)return false;
  const d=new Date(row.ratings_refreshed_at);
  if(Number.isNaN(d.getTime()))return false;
  return Date.now()-d.getTime()<pikoScoreV3FreshnessDays(row)*86400000;
}

// Kept only for import compatibility. Rating refresh is now persisted by title-ratings.
export async function finalizeRatingsRefresh(){return true;}
