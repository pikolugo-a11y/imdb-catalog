import 'server-only';
import {omdbMinimumByImdb} from './omdb-minimum';

export async function resolveManualNewsCandidate(imdbId){
  let omdb=null,omdbError=null;
  try{omdb=await omdbMinimumByImdb(imdbId)}catch(e){omdbError=e?.message||String(e)}

  const candidate_type=omdb?.candidate_type||null;
  const year=omdb?.year||null;
  const imdb_rating=omdb?.imdb_rating??null;
  const imdb_votes=omdb?.imdb_votes??null;
  const title=omdb?.title||null;
  const ready=Boolean(candidate_type&&title);

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
      manualResolveStatus:ready?'complete':'failed',
      manualResolver:'omdb',
      omdbStatus:omdb?'complete':'failed',
      omdbError,
      minimums:{imdb:true,title:Boolean(title),year:Boolean(year),type:Boolean(candidate_type),rating:imdb_rating!=null,votes:imdb_votes!=null}
    }
  };
}
