import 'server-only';
import {createGunzip} from 'node:zlib';
import {Readable} from 'node:stream';
import {createInterface} from 'node:readline';

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
      // IMDb tconsts in the dataset are ordered; once we pass the target we can stop early.
      if(id>imdbId)break;
    }
    return null;
  }catch(e){if(e?.name==='AbortError')return null;return null}finally{clearTimeout(timer)}
}
