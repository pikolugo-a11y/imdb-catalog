import 'server-only';
import {db} from './db';
import {createApiGate} from './batch-api-governance.mjs';

const tmdbOk=value=>/^\d+$/.test(String(value||''));

async function fetchTmdbSeries(apiGate,tmdbId){
  const token=process.env.TMDB_API_TOKEN;
  if(!token)throw new Error('TMDB_API_TOKEN no está configurado en Vercel');
  const permit=await apiGate.acquire('tmdb',{lane:'manual',owner:'tmdb-only-identity'});
  try{
    const controller=new AbortController();
    const timer=setTimeout(()=>controller.abort(),15000);
    try{
      const response=await fetch(`https://api.themoviedb.org/3/tv/${tmdbId}?language=es-ES&append_to_response=credits,external_ids`,{headers:{Authorization:`Bearer ${token}`,Accept:'application/json'},signal:controller.signal,cache:'no-store'});
      if(!response.ok){const error=Object.assign(new Error(`HTTP ${response.status} en api.themoviedb.org`),{status:response.status,retryable:response.status===429||response.status>=500,source:'tmdb'});throw error}
      const data=await response.json();
      await apiGate.success('tmdb');
      return data;
    }finally{clearTimeout(timer)}
  }catch(error){await apiGate.failure('tmdb',error,{lane:'manual'}).catch(()=>{});throw error}
  finally{await apiGate.release(permit).catch(()=>{})}
}

function shaped(data){
  const cast=(data.credits?.cast||[]).slice(0,15).map((x,i)=>({id:String(x.id),name:x.name,character:x.character||'',order:x.order??i,profile_path:x.profile_path||null,known_for_department:x.known_for_department||'Acting'}));
  const creators=(data.created_by||[]).map((x,i)=>({id:String(x.id),name:x.name,character:'',order:i,profile_path:x.profile_path||null,known_for_department:'Directing'}));
  return{
    id:String(data.id),title:data.name||null,originalTitle:data.original_name||null,
    year:Number(String(data.first_air_date||'').slice(0,4))||null,
    runtime:data.episode_run_time?.[0]||data.last_episode_to_air?.runtime||null,
    country:(data.origin_country||[]).join(', ')||null,
    rating:data.vote_average??null,votes:data.vote_count??null,
    poster:data.poster_path||null,backdrop:data.backdrop_path||null,
    overview:data.overview||null,language:data.original_language||null,releaseDate:data.first_air_date||null,
    genres:(data.genres||[]).map(x=>x.name).filter(Boolean),cast,creators
  };
}

export async function enrichTitleTmdbOnly(internalId){
  const sql=db(),apiGate=createApiGate(sql);
  const[row]=await sql`SELECT imdb_id,type,tmdb_id,source_status FROM movies WHERE imdb_id=${internalId}`;
  if(!row)throw new Error('Título no encontrado');
  if(row.type!=='Serie'&&row.type!=='Miniserie')throw new Error('TMDb solo únicamente está disponible para series y miniseries');
  if(row.source_status?.identity_mode!=='tmdb_only')throw new Error('La serie no está configurada como TMDb solo');
  if(!tmdbOk(row.tmdb_id))throw new Error('La serie no tiene un TMDb ID válido');
  const d=shaped(await fetchTmdbSeries(apiGate,String(row.tmdb_id)));
  const sourceStatus=JSON.stringify({...row.source_status,identity_mode:'tmdb_only',tmdb:'ok',imdb:'not_applicable',filmaffinity:'not_applicable',wikidata:'not_applicable',enriched_by:'tmdb-only-identity',enriched_at:new Date().toISOString()});
  const ops=[
    sql`UPDATE movies SET type='Serie',title=${d.title},title_es=${d.title},original_title=${d.originalTitle},year=${d.year},runtime=${d.runtime},country=${d.country},final_rating=${d.rating},imdb_rating=NULL,imdb_votes=NULL,imdb_url=NULL,fa_id=NULL,fa_rating=NULL,fa_votes=NULL,fa_url=NULL,tmdb_id=${d.id},tmdb_rating=${d.rating},tmdb_votes=${d.votes},tmdb_url=${`https://www.themoviedb.org/tv/${d.id}`},wikidata_id=NULL,source_status=${sourceStatus}::jsonb,source_generated_at=now(),synced_at=now(),poster_path=${d.poster},backdrop_path=${d.backdrop},artwork_synced_at=now(),artwork_source='tmdb' WHERE imdb_id=${internalId}`,
    sql`INSERT INTO movie_metadata(imdb_id,overview,original_language,release_date,metadata_enriched_at,metadata_source) VALUES(${internalId},${d.overview},${d.language},${d.releaseDate},now(),'tmdb') ON CONFLICT(imdb_id) DO UPDATE SET overview=EXCLUDED.overview,original_language=EXCLUDED.original_language,release_date=EXCLUDED.release_date,metadata_enriched_at=now(),metadata_source='tmdb'`,
    sql`DELETE FROM movie_genres WHERE imdb_id=${internalId}`,
    ...d.genres.map(g=>sql`INSERT INTO movie_genres(imdb_id,genre) VALUES(${internalId},${g}) ON CONFLICT DO NOTHING`),
    sql`DELETE FROM movie_credits WHERE imdb_id=${internalId}`
  ];
  for(const p of[...d.creators,...d.cast])ops.push(sql`INSERT INTO people(tmdb_person_id,name,profile_path,known_for_department,updated_at) VALUES(${p.id},${p.name},${p.profile_path},${p.known_for_department},now()) ON CONFLICT(tmdb_person_id) DO UPDATE SET name=EXCLUDED.name,profile_path=EXCLUDED.profile_path,known_for_department=COALESCE(EXCLUDED.known_for_department,people.known_for_department),updated_at=now()`);
  for(const p of d.creators)ops.push(sql`INSERT INTO movie_credits(imdb_id,tmdb_person_id,credit_type,character_name,job,credit_order) VALUES(${internalId},${p.id},'crew','','Creator',${p.order}) ON CONFLICT DO NOTHING`);
  for(const p of d.cast)ops.push(sql`INSERT INTO movie_credits(imdb_id,tmdb_person_id,credit_type,character_name,job,credit_order) VALUES(${internalId},${p.id},'cast',${p.character},NULL,${p.order}) ON CONFLICT DO NOTHING`);
  await sql.transaction(ops);
  return{title:d.title,tmdbId:d.id,identityMode:'tmdb_only'};
}
