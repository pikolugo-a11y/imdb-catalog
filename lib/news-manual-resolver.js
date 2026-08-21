import 'server-only';
import {omdbMinimumByImdb} from './omdb-minimum';
import {imdbRatingFromOfficialDataset} from './imdb-rating-on-demand';

export async function resolveManualNewsCandidate(imdbId){
  let omdb=null,omdbError=null;
  try{omdb=await omdbMinimumByImdb(imdbId)}catch(e){omdbError=e?.message||String(e)}

  let rating=null;
  if(omdb?.imdb_rating==null||omdb?.imdb_votes==null){
    try{rating=await imdbRatingFromOfficialDataset(imdbId,{timeoutMs:12000})}catch{}
  }

  const candidate_type=omdb?.candidate_type||null;
  const year=omdb?.year||null;
  const imdb_rating=omdb?.imdb_rating??rating?.rating??null;
  const imdb_votes=omdb?.imdb_votes??rating?.votes??null;
  const title=omdb?.title||imdbId;
  const ready=Boolean(candidate_type&&year&&title!==imdbId&&imdb_rating!=null&&imdb_votes!=null);

  return {
    candidate_type,
    year,
    imdb_rating,
    imdb_votes,
    ready,
    source_snapshot:{
      manual:true,
      manualActive:true,
      matchedRule:'manual',
      discoveryVersion:'novedades-v1',
      title,
      originalTitle:title,
      manualResolvedAt:new Date().toISOString(),
      manualResolver:omdb?'omdb':'dataset-fallback',
      omdbStatus:omdb?'complete':'failed',
      omdbError,
      imdb_ratings_source:rating?.source||null,
      minimums:{imdb:true,title:title!==imdbId,year:Boolean(year),type:Boolean(candidate_type),rating:imdb_rating!=null,votes:imdb_votes!=null}
    }
  };
}
