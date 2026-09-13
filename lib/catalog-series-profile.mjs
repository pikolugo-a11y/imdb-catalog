import {requireApiGate} from './batch-api-governance.mjs';

const PROFILE_MAX_AGE_DAYS=30;
const isSeries=type=>['Serie','Miniserie'].includes(String(type||''));
const uniq=xs=>[...new Set((xs||[]).map(x=>String(x||'').trim()).filter(Boolean))];

function providerNames(block){
  const groups=['flatrate','free','ads','buy','rent'];
  return uniq(groups.flatMap(key=>(block?.[key]||[]).map(x=>x?.provider_name)));
}

async function tmdbJson(path,{apiGate,trace,lane='batch'}={}){
  const token=process.env.TMDB_API_TOKEN;if(!token)throw Object.assign(new Error('Falta TMDB_API_TOKEN'),{permanent:true,source:'tmdb'});
  const gate=requireApiGate(apiGate,'tmdb');let permit=null;
  try{
    permit=await gate.acquire('tmdb',{lane,owner:`series-profile:${lane}`});
    await trace?.externalCall?.(1);
    const response=await fetch(`https://api.themoviedb.org/3${path}`,{headers:{Authorization:`Bearer ${token}`,Accept:'application/json'},cache:'no-store'}),text=await response.text();
    let body=null;try{body=text?JSON.parse(text):null}catch{body=text}
    if(!response.ok){const error=Object.assign(new Error(`TMDb HTTP ${response.status}${text?`: ${text.slice(0,200)}`:''}`),{status:response.status,source:'tmdb',retryable:response.status>=500||response.status===429});await gate.failure('tmdb',error,{lane});throw error}
    await gate.success('tmdb');return body;
  }finally{await gate.release(permit)}
}

export async function selectCatalogSeriesProfileEligible(sql){
  const rows=await sql`SELECT m.imdb_id FROM movies m LEFT JOIN catalog_exclusions ex USING(imdb_id) WHERE ex.imdb_id IS NULL AND m.type IN ('Serie','Miniserie') AND m.tmdb_id IS NOT NULL AND (NULLIF(m.source_status #>> '{series_profile,seasons}','') IS NULL OR NULLIF(m.source_status #>> '{series_profile,episodes}','') IS NULL OR NULLIF(m.source_status #>> '{series_profile,checked_at}','') IS NULL OR (m.source_status #>> '{series_profile,checked_at}')::timestamptz<=now()-(${PROFILE_MAX_AGE_DAYS} * interval '1 day')) ORDER BY m.imdb_id`;
  return rows.map(x=>String(x.imdb_id));
}

export async function refreshCatalogSeriesProfileCanonical(sql,imdbId,{apiGate,trace,lane='batch'}={}){
  const[m]=await sql`SELECT imdb_id,tmdb_id,type,source_status FROM movies WHERE imdb_id=${imdbId} LIMIT 1`;
  if(!m)throw Object.assign(new Error('Título no encontrado'),{permanent:true,processStep:'load_title'});
  if(!isSeries(m.type))throw Object.assign(new Error('El título ya no es una serie'),{permanent:true,processStep:'validate_series'});
  if(!m.tmdb_id)throw Object.assign(new Error('La serie no tiene TMDb ID'),{permanent:true,processStep:'validate_tmdb'});
  const d=await tmdbJson(`/tv/${encodeURIComponent(m.tmdb_id)}?language=es-ES&append_to_response=watch%2Fproviders`,{apiGate,trace,lane});
  const es=d?.['watch/providers']?.results?.ES||{},streaming=[...(es.flatrate||[]),...(es.free||[]),...(es.ads||[])],allProviders=providerNames(es);
  const seasons=Math.max(0,Number(d?.number_of_seasons)||0),episodes=Math.max(0,Number(d?.number_of_episodes)||0),checkedAt=new Date().toISOString();
  const profile={version:1,source:'tmdb',tmdb_id:String(m.tmdb_id),seasons,episodes,status:d?.status||null,origin_country:uniq(d?.origin_country),original_language:d?.original_language||null,spain:{streaming:streaming.length>0,any:allProviders.length>0,providers:allProviders.slice(0,20),link:es?.link||null},checked_at:checkedAt};
  const before=m.source_status?.series_profile||null;
  await sql`UPDATE movies SET source_status=jsonb_set(COALESCE(source_status,'{}'::jsonb),'{series_profile}',${JSON.stringify(profile)}::jsonb,true),synced_at=now() WHERE imdb_id=${imdbId}`;
  if(d?.original_language)await sql`INSERT INTO movie_metadata(imdb_id,original_language,metadata_enriched_at,metadata_source) VALUES(${imdbId},${d.original_language},now(),'tmdb') ON CONFLICT(imdb_id) DO UPDATE SET original_language=COALESCE(movie_metadata.original_language,EXCLUDED.original_language),metadata_enriched_at=now()`;
  await trace?.event?.({eventType:'step_completed',step:'catalog_series_profile',entityType:'series',entityId:imdbId,message:`Estructura: ${seasons} temporadas · ${episodes} episodios`,data:{seasons,episodes,spain_streaming:profile.spain.streaming,providers:profile.spain.providers}});
  const changed=Number(before?.seasons)!==seasons||Number(before?.episodes)!==episodes||Boolean(before?.spain?.streaming)!==profile.spain.streaming;
  return{technicalStatus:'succeeded',functionalResult:changed?'updated':'no_change',before:before?{seasons:Number(before.seasons||0),episodes:Number(before.episodes||0),spain_streaming:Boolean(before?.spain?.streaming)}:null,after:{seasons,episodes,spain_streaming:profile.spain.streaming,providers:profile.spain.providers,checked_at:checkedAt},metrics:{seasons,episodes,spain_streaming:profile.spain.streaming?1:0,providers:profile.spain.providers.length},message:`Perfil de serie actualizado: ${seasons} temporadas · ${episodes} episodios${profile.spain.streaming?' · disponible en streaming en España':''}`};
}
