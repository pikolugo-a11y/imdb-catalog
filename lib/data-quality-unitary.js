import 'server-only';
import {db} from './db';
import {DATA_FIELDS,getDataQualityTitle} from './data-quality';
import {recomputeLifecycleForIds} from './lifecycle';
import {audit} from './runlog';
import {fetchMDBListMetadata} from './ratings-provider-mdblist';
import {loggedJsonFetch} from './data-quality-api-log';

const clean=v=>v&&v!=='N/A'?String(v).trim():null;
const list=v=>String(v||'').split(',').map(x=>x.trim()).filter(Boolean);
const omdbKey=()=>process.env.OMDB_API_KEY||process.env.OMDB_APIKEY||'';
const parseRuntime=v=>{const m=String(v||'').match(/(\d+)\s*min/i);return m?Number(m[1]):null};
const median=values=>{const a=values.map(Number).filter(n=>Number.isFinite(n)&&n>0).sort((x,y)=>x-y);if(!a.length)return null;const i=Math.floor(a.length/2);return a.length%2?a[i]:Math.round((a[i-1]+a[i])/2)};
const fields=Object.keys(DATA_FIELDS);
const CAPABILITIES={TMDb:new Set(fields),OMDb:new Set(['type','title_es','original_title','year','runtime','country','genres','overview','poster_path','release_date','director','cast','original_language']),MDBList:new Set(['type','title_es','original_title','year','runtime','country','genres','overview','poster_path','backdrop_path','release_date','director','cast','original_language'])};
const isSeriesType=type=>['Serie','Miniserie'].includes(String(type||''));
const mediaFromType=type=>isSeriesType(type)?'tv':'movie';
const typeFromMedia=media=>media==='tv'?'Serie':'Película';

function hasField(row,key){
  if(!row)return false;
  if(key==='poster_path')return Boolean(row.poster_path||row.external_poster_url);
  if(key==='backdrop_path')return Boolean(row.backdrop_path||row.external_backdrop_url);
  if(key==='director')return Boolean(row.director||row.external_director);
  if(key==='cast')return Boolean(row.cast||row.external_cast);
  if(key==='genres')return Boolean(row.genres);
  if(key==='runtime')return Number(row.runtime)>0;
  if(key==='year')return Number(row.year)>1800;
  return row[key]!==null&&row[key]!==undefined&&row[key]!==''&&row[key]!==false;
}
function missingFields(row){return fields.filter(k=>!hasField(row,k));}
function wantedFor(row,source){const supported=CAPABILITIES[source]||new Set();return new Set(missingFields(row).filter(k=>supported.has(k)));}
function shouldRun(row,source){return wantedFor(row,source).size>0;}

async function sourceStep(imdbId,source,fn,before){
  const started=Date.now(),attempted=[...wantedFor(before,source)];
  await audit('data_quality','title',imdbId,'source_refresh_started',{source,attempted,type:before?.type||null,tmdb_id:before?.tmdb_id||null});
  try{
    const changed=await fn(imdbId,new Set(attempted));
    const after=await getDataQualityTitle(imdbId),remaining=missingFields(after);
    await audit('data_quality','title',imdbId,'source_refresh_completed',{source,attempted,changed,remaining,duration_ms:Date.now()-started});
    return{source,ok:true,attempted,changed,remaining};
  }catch(e){
    const message=e?.message||String(e);
    await audit('data_quality','title',imdbId,'source_refresh_failed',{source,attempted,message,duration_ms:Date.now()-started});
    return{source,ok:false,attempted,changed:[],error:message};
  }
}

async function patchSourceStatus(sql,imdbId,patch){if(!Object.keys(patch).length)return;await sql`UPDATE movies SET source_status=COALESCE(source_status,'{}'::jsonb)||${JSON.stringify(patch)}::jsonb,synced_at=now() WHERE imdb_id=${imdbId}`;}
async function setExternalPoster(sql,imdbId,url,source){if(url)await patchSourceStatus(sql,imdbId,{data_quality_external_poster:{url,source,checked_at:new Date().toISOString()}});}
async function setExternalBackdrop(sql,imdbId,url,source){if(url)await patchSourceStatus(sql,imdbId,{data_quality_external_backdrop:{url,source,checked_at:new Date().toISOString()}});}
async function setExternalPeople(sql,imdbId,{director,cast},source){const patch={};if(director)patch.data_quality_external_director={value:director,source,checked_at:new Date().toISOString()};if(cast?.length)patch.data_quality_external_cast={value:cast,source,checked_at:new Date().toISOString()};await patchSourceStatus(sql,imdbId,patch);}
async function tmdbFetch(imdbId,path,token){const url=`https://api.themoviedb.org/3${path}`;const {response,body}=await loggedJsonFetch({imdbId,source:'TMDb',url,options:{headers:{Authorization:`Bearer ${token}`,Accept:'application/json'}}});if(!response.ok)throw new Error(`TMDb HTTP ${response.status} en ${path.split('?')[0]}${body?.status_message?`: ${body.status_message}`:''}`);return body;}

function bestAggregateDirector(data){let best=null,bestEpisodes=-1;for(const p of data?.aggregate_credits?.crew||[]){const jobs=(p.jobs||[]).filter(j=>j?.job==='Director'),episodes=jobs.reduce((s,j)=>s+Number(j?.episode_count||0),0);if(jobs.length&&episodes>bestEpisodes){best=p;bestEpisodes=episodes;}}return best;}
function countDirector(map,p){if(!p?.id||!p?.name)return;const key=String(p.id),prev=map.get(key)||{...p,count:0};prev.count+=1;map.set(key,prev);}
async function seriesEpisodeFacts(imdbId,tmdbId,details,token,{needRuntime=false,needDirector=false}={}){
  const runtimes=[],directors=new Map(),episodeRefs=[];
  const seasons=(details?.seasons||[]).filter(s=>Number(s?.season_number)>0).sort((a,b)=>Number(a.season_number)-Number(b.season_number)).slice(0,6);
  for(const season of seasons){
    try{
      const sd=await tmdbFetch(imdbId,`/tv/${tmdbId}/season/${season.season_number}?language=es-ES`,token);
      for(const ep of sd?.episodes||[]){
        if(needRuntime&&Number(ep?.runtime)>0)runtimes.push(Number(ep.runtime));
        if(needDirector)for(const p of ep?.crew||[])if(p?.job==='Director')countDirector(directors,p);
        if(needDirector&&episodeRefs.length<8)episodeRefs.push({season:season.season_number,episode:ep.episode_number});
      }
      if((!needRuntime||runtimes.length>=5)&&(!needDirector||directors.size))break;
    }catch{}
  }
  if(needDirector&&!directors.size){for(const ref of episodeRefs){try{const cr=await tmdbFetch(imdbId,`/tv/${tmdbId}/season/${ref.season}/episode/${ref.episode}/credits`,token);for(const p of cr?.crew||[])if(p?.job==='Director')countDirector(directors,p);}catch{}}}
  const director=[...directors.values()].sort((a,b)=>b.count-a.count)[0]||null;
  return{runtime:median(runtimes),director};
}
async function persistTmdbPerson(sql,imdbId,person){if(!person?.id)return;await sql`INSERT INTO people(tmdb_person_id,name,profile_path,known_for_department,updated_at) VALUES(${String(person.id)},${person.name},${person.profile_path||null},${person.known_for_department||'Directing'},now()) ON CONFLICT(tmdb_person_id) DO UPDATE SET name=EXCLUDED.name,profile_path=EXCLUDED.profile_path,updated_at=now()`;await sql`INSERT INTO movie_credits(imdb_id,tmdb_person_id,credit_type,character_name,job,credit_order) VALUES(${imdbId},${String(person.id)},'crew','','Director',NULL) ON CONFLICT DO NOTHING`;}

async function refreshTmdb(imdbId,wanted){
  const sql=db(),before=await getDataQualityTitle(imdbId),[m]=await sql`SELECT tmdb_id,type FROM movies WHERE imdb_id=${imdbId}`;
  if(!m?.tmdb_id)throw new Error('Falta TMDb ID');
  const token=process.env.TMDB_API_TOKEN;if(!token)throw new Error('Falta TMDB_API_TOKEN');
  const media=mediaFromType(m.type),d=await tmdbFetch(imdbId,`/${media}/${m.tmdb_id}?language=es-ES&append_to_response=credits,aggregate_credits`,token),changed=[];
  const title=d.title||d.name||null,original=d.original_title||d.original_name||null,release=d.release_date||d.first_air_date||null,year=Number(String(release||'').slice(0,4))||null;
  let runtime=d.runtime||d.episode_run_time?.[0]||d.last_episode_to_air?.runtime||d.next_episode_to_air?.runtime||null;
  let director=media==='tv'?bestAggregateDirector(d):(d.credits?.crew||[]).find(x=>x.job==='Director');
  if(media==='tv'&&((wanted.has('runtime')&&!runtime)||(wanted.has('director')&&!director))){const facts=await seriesEpisodeFacts(imdbId,m.tmdb_id,d,token,{needRuntime:wanted.has('runtime')&&!runtime,needDirector:wanted.has('director')&&!director});runtime=runtime||facts.runtime;director=director||facts.director;}
  let poster=d.poster_path||null,backdrop=d.backdrop_path||null;
  if((wanted.has('poster_path')&&!poster)||(wanted.has('backdrop_path')&&!backdrop)){try{const images=await tmdbFetch(imdbId,`/${media}/${m.tmdb_id}/images?include_image_language=es,null,en`,token);poster=poster||images?.posters?.find(x=>x?.file_path)?.file_path||null;backdrop=backdrop||images?.backdrops?.find(x=>x?.file_path)?.file_path||null;}catch{}}
  const type=typeFromMedia(media),country=(d.production_countries||d.origin_country||[]).map(x=>x.name||x).filter(Boolean).join(', ')||null,genres=(d.genres||[]).map(x=>x.name).filter(Boolean),cast=(d.credits?.cast||d.aggregate_credits?.cast||[]).slice(0,15);
  await sql`UPDATE movies SET type=COALESCE(type,${wanted.has('type')?type:null}),title_es=COALESCE(title_es,${wanted.has('title_es')?title:null}),original_title=COALESCE(original_title,${wanted.has('original_title')?original:null}),year=COALESCE(year,${wanted.has('year')?year:null}),runtime=COALESCE(runtime,${wanted.has('runtime')?runtime:null}),country=COALESCE(country,${wanted.has('country')?country:null}),poster_path=COALESCE(poster_path,${wanted.has('poster_path')?poster:null}),backdrop_path=COALESCE(backdrop_path,${wanted.has('backdrop_path')?backdrop:null}),synced_at=now() WHERE imdb_id=${imdbId}`;
  for(const[k,v]of Object.entries({type,title_es:title,original_title:original,year,runtime,country,poster_path:poster,backdrop_path:backdrop}))if(wanted.has(k)&&v!=null&&v!==''&&!hasField(before,k))changed.push(k);
  const overview=wanted.has('overview')?d.overview||null:null,language=wanted.has('original_language')?d.original_language||null:null,rel=wanted.has('release_date')?release:null;
  if(overview||language||rel){await sql`INSERT INTO movie_metadata(imdb_id,overview,original_language,release_date,metadata_enriched_at,metadata_source) VALUES(${imdbId},${overview},${language},${rel},now(),'tmdb') ON CONFLICT(imdb_id) DO UPDATE SET overview=COALESCE(movie_metadata.overview,EXCLUDED.overview),original_language=COALESCE(movie_metadata.original_language,EXCLUDED.original_language),release_date=COALESCE(movie_metadata.release_date,EXCLUDED.release_date),metadata_enriched_at=now(),metadata_source='tmdb'`;if(overview)changed.push('overview');if(language)changed.push('original_language');if(rel)changed.push('release_date');}
  if(wanted.has('genres')&&genres.length){for(const g of genres)await sql`INSERT INTO movie_genres(imdb_id,genre) VALUES(${imdbId},${g}) ON CONFLICT DO NOTHING`;changed.push('genres');}
  if(wanted.has('director')&&director?.id){await persistTmdbPerson(sql,imdbId,director);changed.push('director');}
  if(wanted.has('cast')&&cast.length){for(const a of cast){if(!a?.id)continue;await sql`INSERT INTO people(tmdb_person_id,name,profile_path,known_for_department,updated_at) VALUES(${String(a.id)},${a.name},${a.profile_path||null},${a.known_for_department||'Acting'},now()) ON CONFLICT(tmdb_person_id) DO UPDATE SET name=EXCLUDED.name,profile_path=EXCLUDED.profile_path,updated_at=now()`;await sql`INSERT INTO movie_credits(imdb_id,tmdb_person_id,credit_type,character_name,job,credit_order) VALUES(${imdbId},${String(a.id)},'cast',${a.character||a.roles?.[0]?.character||''},'',${a.order??0}) ON CONFLICT DO NOTHING`;}changed.push('cast');}
  return[...new Set(changed)];
}

async function refreshOmdb(imdbId,wanted){
  const sql=db(),before=await getDataQualityTitle(imdbId),key=omdbKey();if(!key)throw new Error('Falta OMDB_API_KEY');
  const url=`https://www.omdbapi.com/?apikey=${encodeURIComponent(key)}&i=${encodeURIComponent(imdbId)}&plot=full`,{response:r,body:j}=await loggedJsonFetch({imdbId,source:'OMDb',url});
  if(!r.ok)throw new Error(`OMDb HTTP ${r.status}`);if(j?.Response==='False')throw new Error(j.Error||'OMDb no encontró el título');
  const changed=[],type=String(j?.Type||'').toLowerCase()==='series'?'Serie':String(j?.Type||'').toLowerCase()==='movie'?'Película':null,title=clean(j?.Title),runtime=parseRuntime(j?.Runtime),country=clean(j?.Country),year=Number(String(j?.Year||'').slice(0,4))||null,poster=clean(j?.Poster);
  await sql`UPDATE movies SET type=COALESCE(type,${wanted.has('type')?type:null}),title_es=COALESCE(title_es,${wanted.has('title_es')?title:null}),original_title=COALESCE(original_title,${wanted.has('original_title')?title:null}),runtime=COALESCE(runtime,${wanted.has('runtime')?runtime:null}),country=COALESCE(country,${wanted.has('country')?country:null}),year=COALESCE(year,${wanted.has('year')?year:null}),synced_at=now() WHERE imdb_id=${imdbId}`;
  for(const[k,v]of Object.entries({type,title_es:title,original_title:title,runtime,country,year}))if(wanted.has(k)&&v!=null&&!hasField(before,k))changed.push(k);
  const overview=wanted.has('overview')?clean(j?.Plot):null,language=wanted.has('original_language')?clean(j?.Language):null,release=wanted.has('release_date')&&j?.Released&&j.Released!=='N/A'?new Date(j.Released):null;
  if(overview||language||release){await sql`INSERT INTO movie_metadata(imdb_id,overview,original_language,release_date,metadata_enriched_at,metadata_source) VALUES(${imdbId},${overview},${language},${release},now(),'omdb') ON CONFLICT(imdb_id) DO UPDATE SET overview=COALESCE(movie_metadata.overview,EXCLUDED.overview),original_language=COALESCE(movie_metadata.original_language,EXCLUDED.original_language),release_date=COALESCE(movie_metadata.release_date,EXCLUDED.release_date),metadata_enriched_at=now(),metadata_source=CASE WHEN movie_metadata.overview IS NULL OR movie_metadata.original_language IS NULL OR movie_metadata.release_date IS NULL THEN 'omdb' ELSE movie_metadata.metadata_source END`;if(overview)changed.push('overview');if(language)changed.push('original_language');if(release)changed.push('release_date');}
  if(wanted.has('genres')){const genres=list(j?.Genre);for(const g of genres)await sql`INSERT INTO movie_genres(imdb_id,genre) VALUES(${imdbId},${g}) ON CONFLICT DO NOTHING`;if(genres.length)changed.push('genres');}
  if(wanted.has('poster_path')&&poster){await setExternalPoster(sql,imdbId,poster,'OMDb');changed.push('poster_path');}
  const director=wanted.has('director')?clean(j?.Director):null,cast=wanted.has('cast')?list(j?.Actors):[];
  if(director||cast.length){await setExternalPeople(sql,imdbId,{director,cast},'OMDb');if(director)changed.push('director');if(cast.length)changed.push('cast');}
  return[...new Set(changed)];
}

async function refreshMdblist(imdbId,wanted){
  const sql=db(),before=await getDataQualityTitle(imdbId);if(!before)throw new Error('Título no encontrado');
  const {metadata}=await fetchMDBListMetadata({imdbId,mediaType:before.type||'movie',auditImdbId:imdbId}),changed=[];
  const title=clean(metadata.title),runtime=Number(metadata.runtime)||null,country=clean(metadata.country),original=clean(metadata.original_title||metadata.title),year=Number(metadata.year)||null,type=metadata.type||null;
  await sql`UPDATE movies SET type=COALESCE(type,${wanted.has('type')?type:null}),title_es=COALESCE(title_es,${wanted.has('title_es')?title:null}),original_title=COALESCE(original_title,${wanted.has('original_title')?original:null}),runtime=COALESCE(runtime,${wanted.has('runtime')?runtime:null}),country=COALESCE(country,${wanted.has('country')?country:null}),year=COALESCE(year,${wanted.has('year')?year:null}),synced_at=now() WHERE imdb_id=${imdbId}`;
  for(const[k,v]of Object.entries({type,title_es:title,original_title:original,runtime,country,year}))if(wanted.has(k)&&v!=null&&!hasField(before,k))changed.push(k);
  const overview=wanted.has('overview')?clean(metadata.overview):null,language=wanted.has('original_language')?clean(metadata.original_language):null,release=wanted.has('release_date')&&metadata.release_date?new Date(metadata.release_date):null;
  if(overview||language||release){await sql`INSERT INTO movie_metadata(imdb_id,overview,original_language,release_date,metadata_enriched_at,metadata_source) VALUES(${imdbId},${overview},${language},${release},now(),'mdblist') ON CONFLICT(imdb_id) DO UPDATE SET overview=COALESCE(movie_metadata.overview,EXCLUDED.overview),original_language=COALESCE(movie_metadata.original_language,EXCLUDED.original_language),release_date=COALESCE(movie_metadata.release_date,EXCLUDED.release_date),metadata_enriched_at=now(),metadata_source=CASE WHEN movie_metadata.overview IS NULL OR movie_metadata.original_language IS NULL OR movie_metadata.release_date IS NULL THEN 'mdblist' ELSE movie_metadata.metadata_source END`;if(overview)changed.push('overview');if(language)changed.push('original_language');if(release)changed.push('release_date');}
  if(wanted.has('genres')&&metadata.genres?.length){for(const g of metadata.genres)await sql`INSERT INTO movie_genres(imdb_id,genre) VALUES(${imdbId},${g}) ON CONFLICT DO NOTHING`;changed.push('genres');}
  if(wanted.has('poster_path')&&metadata.poster){await setExternalPoster(sql,imdbId,metadata.poster,'MDBList');changed.push('poster_path');}
  if(wanted.has('backdrop_path')&&metadata.backdrop){await setExternalBackdrop(sql,imdbId,metadata.backdrop,'MDBList');changed.push('backdrop_path');}
  const director=wanted.has('director')?clean(metadata.director):null,cast=wanted.has('cast')?(metadata.cast||[]):[];
  if(director||cast.length){await setExternalPeople(sql,imdbId,{director,cast},'MDBList');if(director)changed.push('director');if(cast.length)changed.push('cast');}
  return[...new Set(changed)];
}

async function runCascade(imdbId,current,results){
  let row=current;
  for(const[source,fn]of[['TMDb',refreshTmdb],['OMDb',refreshOmdb],['MDBList',refreshMdblist]]){
    if(!shouldRun(row,source))continue;
    results.push(await sourceStep(imdbId,source,fn,row));
    row=await getDataQualityTitle(imdbId)||row;
  }
  return row;
}

export async function updateDataQualityTitle(imdbId){
  if(!/^tt\d+$/.test(String(imdbId||'')))throw new Error('IMDb ID inválido');
  const before=await getDataQualityTitle(imdbId);if(!before)throw new Error('Título no encontrado');
  if(before.validation_status!=='valid')throw new Error('La identidad debe estar validada antes de actualizar datos');
  await audit('data_quality','title',imdbId,'unitary_refresh_started',{coverage:before.coverage,missing:missingFields(before),type:before.type,tmdb_id:before.tmdb_id});
  const results=[];await runCascade(imdbId,before,results);
  const after=await getDataQualityTitle(imdbId),lifecycle=(await recomputeLifecycleForIds([imdbId])).get(imdbId);
  await audit('data_quality','title',imdbId,'unitary_refresh_completed',{coverage_before:before.coverage,coverage_after:after?.coverage,missing:missingFields(after),lifecycle:lifecycle?.state,results});
  return{before,after,results,lifecycle,missing:missingFields(after)};
}
