import 'server-only';
import {createGunzip} from 'node:zlib';
import {Readable} from 'node:stream';
import {createInterface} from 'node:readline';
import {db} from '@/lib/db';

const DATASET='https://datasets.imdbws.com/title.ratings.tsv.gz';

export async function imdbRatingFromOfficialDataset(imdbId,{timeoutMs=12000}={}){
  if(!/^tt\d+$/.test(String(imdbId||'')))return null;
  const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),timeoutMs);
  try{
    const response=await fetch(DATASET,{signal:controller.signal,cache:'no-store',headers:{'User-Agent':'PikoFilm/2.0 personal-noncommercial-single-rating'}});
    if(!response.ok||!response.body)return null;
    const rl=createInterface({input:Readable.fromWeb(response.body).pipe(createGunzip()),crlfDelay:Infinity});let header=true;
    for await(const line of rl){
      if(header){header=false;continue}
      const firstTab=line.indexOf('\t');if(firstTab<0)continue;const id=line.slice(0,firstTab);
      if(id===imdbId){const parts=line.split('\t'),rating=Number(parts[1]),votes=Number(parts[2]);if(Number.isFinite(rating)&&Number.isInteger(votes))return{rating,votes,source:'title.ratings.tsv.gz-on-demand'};return null}
      if(id>imdbId)break;
    }
    return null;
  }catch{return null}finally{clearTimeout(timer)}
}

export async function ensureImdbRating(imdbId,{timeoutMs=12000}={}){
  const sql=db();
  const [existing]=await sql`SELECT imdb_rating,imdb_votes FROM movies WHERE imdb_id=${imdbId} LIMIT 1`;
  if(existing?.imdb_rating!=null&&existing?.imdb_votes!=null)return{rating:Number(existing.imdb_rating),votes:Number(existing.imdb_votes),source:'movies'};
  const [candidate]=await sql`SELECT imdb_rating,imdb_votes FROM catalog_candidates WHERE imdb_id=${imdbId} LIMIT 1`;
  if(candidate?.imdb_rating!=null&&candidate?.imdb_votes!=null)return{rating:Number(candidate.imdb_rating),votes:Number(candidate.imdb_votes),source:'catalog_candidates'};
  const rating=await imdbRatingFromOfficialDataset(imdbId,{timeoutMs});
  if(!rating)return null;
  await sql`INSERT INTO catalog_candidates(imdb_id,imdb_rating,imdb_votes,eligibility_status,first_seen_at,last_seen_at,last_evaluated_at,source_snapshot,created_at,updated_at) VALUES(${imdbId},${rating.rating},${rating.votes},'not_eligible',now(),now(),now(),jsonb_build_object('imdb_ratings_source','title.ratings.tsv.gz-on-demand','imdb_ratings_updated_at',now()),now(),now()) ON CONFLICT(imdb_id) DO UPDATE SET imdb_rating=EXCLUDED.imdb_rating,imdb_votes=EXCLUDED.imdb_votes,last_evaluated_at=now(),source_snapshot=COALESCE(catalog_candidates.source_snapshot,'{}'::jsonb)||jsonb_build_object('imdb_ratings_source','title.ratings.tsv.gz-on-demand','imdb_ratings_updated_at',now()),updated_at=now()`;
  await sql`UPDATE movies SET imdb_rating=${rating.rating},imdb_votes=${rating.votes},source_status=COALESCE(source_status,'{}'::jsonb)||jsonb_build_object('imdb_ratings','dataset_on_demand','imdb_ratings_updated_at',now()),source_generated_at=now(),synced_at=now() WHERE imdb_id=${imdbId}`;
  return rating;
}
