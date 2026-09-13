export const SPANISH_SERIES_MARKET_RESCUE=Object.freeze({minRating:6.5,minVotes:1000});

export function spanishSeriesEligibility({rating,votes},settings){
  const standard=settings?.series?.spain||{},r=Number(rating),v=Number(votes);
  const standardMatch=Number.isFinite(r)&&Number.isFinite(v)&&r>=Number(standard.minRating||0)&&v>=Number(standard.minVotes||0);
  const marketMatch=Number.isFinite(r)&&Number.isFinite(v)&&r>=SPANISH_SERIES_MARKET_RESCUE.minRating&&v>=SPANISH_SERIES_MARKET_RESCUE.minVotes;
  return{eligible:standardMatch||marketMatch,standardMatch,marketRescue:!standardMatch&&marketMatch};
}
