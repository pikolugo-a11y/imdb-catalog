import 'server-only';
import { db } from './db';
import { audit } from './runlog';
import { fetchMDBListRatings } from './ratings-provider-mdblist';
import { getTitleRatings, upsertTitleRating, RATING_SOURCES } from './title-ratings';

async function getMedia(imdbId){const sql=db();const rows=await sql`SELECT type,tmdb_id FROM movies WHERE imdb_id=${imdbId} LIMIT 1`;if(!rows.length)throw new Error(`Título no encontrado: ${imdbId}`);return{mediaType:rows[0].type||'movie',tmdbId:rows[0].tmdb_id||null};}
async function persistMDBListExtras(imdbId,extras={}){if(!extras||!Object.keys(extras).length)return false;const sql=db(),patch={mdblist_metadata:{...extras,provider:'mdblist',fetched_at:new Date().toISOString()}};await sql`UPDATE movies SET source_status=COALESCE(source_status,'{}'::jsonb)||${JSON.stringify(patch)}::jsonb,synced_at=now() WHERE imdb_id=${imdbId}`;return true;}
const available=rows=>rows.filter(x=>x.status==='available'&&Number(x.normalized_rating)>0);
const sourceSet=rows=>new Set(rows.map(x=>String(x.source)));
const providerMiss=e=>Number(e?.status)===404||/MDBList HTTP 404|Item not found/i.test(String(e?.message||''));
async function fetchJson(url,options={}){const r=await fetch(url,{...options,cache:'no-store'});const text=await r.text();let body=null;try{body=text?JSON.parse(text):null}catch{body=text}if(!r.ok){const e=new Error(`HTTP ${r.status}: ${typeof body==='string'?body.slice(0,180):body?.status_message||body?.Error||'error'}`);e.status=r.status;throw e;}return body;}
async function rescueOmdb(imdbId,existing,trace){const key=process.env.OMDB_API_KEY||process.env.OMDB_APIKEY||process.env.OMDB_KEY;if(!key)throw new Error('Falta OMDB_API_KEY');await trace?.externalCall?.(1);const d=await fetchJson(`https://www.omdbapi.com/?apikey=${encodeURIComponent(key)}&i=${encodeURIComponent(imdbId)}&r=json`);if(d?.Response==='False')throw new Error(d?.Error||'OMDb no encontró el título');const have=sourceSet(existing),toSave=[];if(!have.has(RATING_SOURCES.IMDB)){const n=Number(d?.imdbRating);if(Number.isFinite(n)&&n>0)toSave.push({source:RATING_SOURCES.IMDB,rating:n,scale:10,votes:Number(String(d?.imdbVotes||'').replace(/,/g,''))||null,ratingType:'audience',provider:'omdb',rawPayload:{imdbRating:d.imdbRating,imdbVotes:d.imdbVotes}})}for(const x of d?.Ratings||[]){const src=String(x?.Source||''),val=String(x?.Value||'');if(src==='Rotten Tomatoes'&&!have.has(RATING_SOURCES.RT_CRITICS)){const n=Number(val.replace('%',''));if(Number.isFinite(n)&&n>0)toSave.push({source:RATING_SOURCES.RT_CRITICS,rating:n,scale:100,ratingType:'critics',provider:'omdb',rawPayload:x})}if(src==='Metacritic'&&!have.has(RATING_SOURCES.METACRITIC)){const n=Number(val.split('/')[0]);if(Number.isFinite(n)&&n>0)toSave.push({source:RATING_SOURCES.METACRITIC,rating:n,scale:100,ratingType:'critics',provider:'omdb',rawPayload:x})}}for(const r of toSave)await upsertTitleRating({imdbId,...r});return toSave.length;}
async function rescueTmdb(imdbId,tmdbId,mediaType,existing,trace){if(!tmdbId||sourceSet(existing).has(RATING_SOURCES.TMDB))return 0;const token=process.env.TMDB_API_TOKEN;if(!token)throw new Error('Falta TMDB_API_TOKEN');const media=['Serie','Miniserie'].includes(String(mediaType))?'tv':'movie';await trace?.externalCall?.(1);const d=await fetchJson(`https://api.themoviedb.org/3/${media}/${tmdbId}`,{headers:{Authorization:`Bearer ${token}`,Accept:'application/json'}});const rating=Number(d?.vote_average),votes=Number(d?.vote_count);if(!Number.isFinite(rating)||rating<=0)return 0;await upsertTitleRating({imdbId,source:RATING_SOURCES.TMDB,rating,scale:10,votes:Number.isFinite(votes)?votes:null,ratingType:'audience',provider:'tmdb_direct',rawPayload:{vote_average:d.vote_average,vote_count:d.vote_count}});return 1;}

export async function refreshRatingsForTitle(imdbId,{signal,trace}={}){
  if(!/^tt\d+$/.test(String(imdbId||'')))throw new Error('IMDb ID inválido');
  const {mediaType,tmdbId}=await getMedia(imdbId);await audit('ratings','title',imdbId,'ratings_refresh_started',{provider:'cascade'});const started=Date.now(),steps=[];
  let fetched={ratings:[],extras:{},payload:{}},saved=0,extrasSaved=false;
  await trace?.event?.({eventType:'step_started',step:'ratings_mdblist',message:'Consultando MDBList'});
  try{
    await trace?.externalCall?.(1);fetched=await fetchMDBListRatings({imdbId,mediaType,signal});
    for(const rating of fetched.ratings){await upsertTitleRating({imdbId,...rating});saved+=1;}
    extrasSaved=await persistMDBListExtras(imdbId,fetched.extras);
    const current=await getTitleRatings(imdbId),count=available(current).length;steps.push({provider:'mdblist',status:'success',saved,available:count});
    await trace?.event?.({eventType:'step_completed',step:'ratings_mdblist',message:'MDBList completado',data:{saved,available:count}});
  }catch(e){
    if(!providerMiss(e)){await audit('ratings','title',imdbId,'ratings_refresh_failed',{provider:'mdblist',error:e?.message||String(e),status:e?.status||null,duration_ms:Date.now()-started});throw e;}
    steps.push({provider:'mdblist',status:'warning',warningType:'provider_not_found',expected:true,error:e?.message||String(e)});
    await trace?.event?.({eventType:'step_warning',step:'ratings_mdblist',message:'MDBList no conoce el título; se activa la cascada de rescate',data:{status:404,expected:true}});
  }
  let ratings=await getTitleRatings(imdbId),count=available(ratings).length;
  if(count<2){await trace?.event?.({eventType:'step_started',step:'ratings_omdb_rescue',message:'Rescate OMDb'});try{const rescued=await rescueOmdb(imdbId,ratings,trace);ratings=await getTitleRatings(imdbId);count=available(ratings).length;steps.push({provider:'omdb',status:'success',saved:rescued,available:count});await trace?.event?.({eventType:'step_completed',step:'ratings_omdb_rescue',message:'Rescate OMDb completado',data:{saved:rescued,available:count}})}catch(e){steps.push({provider:'omdb',status:'warning',expected:false,error:e?.message||String(e)});await trace?.event?.({eventType:'step_warning',step:'ratings_omdb_rescue',message:'OMDb no pudo rescatar ratings',data:{error:e?.message||String(e)}})}}else{steps.push({provider:'omdb',status:'skipped'});await trace?.event?.({eventType:'step_skipped',step:'ratings_omdb_rescue',message:'OMDb omitido: ya hay ratings suficientes'})}
  if(count<2){await trace?.event?.({eventType:'step_started',step:'ratings_tmdb_rescue',message:'Rescate TMDb directo'});try{const rescued=await rescueTmdb(imdbId,tmdbId,mediaType,ratings,trace);ratings=await getTitleRatings(imdbId);count=available(ratings).length;steps.push({provider:'tmdb_direct',status:'success',saved:rescued,available:count});await trace?.event?.({eventType:'step_completed',step:'ratings_tmdb_rescue',message:'Rescate TMDb completado',data:{saved:rescued,available:count}})}catch(e){steps.push({provider:'tmdb_direct',status:'warning',expected:false,error:e?.message||String(e)});await trace?.event?.({eventType:'step_warning',step:'ratings_tmdb_rescue',message:'TMDb directo no pudo rescatar ratings',data:{error:e?.message||String(e)}})}}else{steps.push({provider:'tmdb_direct',status:'skipped'});await trace?.event?.({eventType:'step_skipped',step:'ratings_tmdb_rescue',message:'TMDb directo omitido: ya hay ratings suficientes'})}
  const verified=count>=2,sql=db();await sql`UPDATE movies SET ratings_refreshed_at=CASE WHEN ${verified} THEN now() ELSE NULL END,synced_at=now() WHERE imdb_id=${imdbId}`;
  await audit('ratings','title',imdbId,'ratings_refresh_completed',{provider:'cascade',received:fetched.ratings.length,saved,available:count,verified,extras_saved:extrasSaved,steps,duration_ms:Date.now()-started});
  return{verified,provider:'cascade',received:fetched.ratings.length,saved,ratings,extras:fetched.extras||{},extrasSaved,steps,available:count};
}

export const refreshRatings=refreshRatingsForTitle;
