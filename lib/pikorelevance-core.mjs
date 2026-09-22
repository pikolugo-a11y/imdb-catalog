import {lookupWikidataByImdb} from './wikidata-source.mjs';

export const PIKORELEVANCE_VERSION='0.2.0';

const DEFAULT_CONFIG={
  weights:{
    pikoscore:12,
    imdb_rating:4,
    imdb_votes:4,
    tmdb_es:15,
    watchmode_es:15,
    eswiki:5,
    eswiki_pageviews:8,
    mediacloud_es:7,
    international_reach:8,
    tmdb_popularity:6,
    momentum:6,
    origin_es:5,
    language_es:3,
    spanish_translation:2,
  },
  thresholds:{very_high:80,high:65,medium:50,low:35,min_confidence:60},
  cacheDays:30,
};

const clamp=(n,min,max)=>Math.max(min,Math.min(max,Number(n)||0));
const uniq=xs=>[...new Set((xs||[]).map(x=>String(x||'').trim()).filter(Boolean))];
const nowIso=()=>new Date().toISOString();
const sleep=ms=>new Promise(r=>setTimeout(r,ms));

export function parseRetryAfterMs(value,{now=Date.now()}={}){
  if(value==null||value==='')return null;
  const seconds=Number(value);
  if(Number.isFinite(seconds)&&seconds>=0)return Math.round(seconds*1000);
  const at=Date.parse(String(value));
  if(!Number.isFinite(at))return null;
  return Math.max(0,at-now);
}

export function retryDelayMs({attempt=0,retryAfter=null,baseBackoffMs=1000,maxBackoffMs=60000}={}){
  const fromHeader=parseRetryAfterMs(retryAfter);
  if(fromHeader!=null)return Math.min(Math.max(0,fromHeader),Math.max(1000,maxBackoffMs));
  return Math.min(Math.max(0,baseBackoffMs)*(2**Math.max(0,attempt)),Math.max(1000,maxBackoffMs));
}

export async function sleepWithHeartbeat(ms,trace=null,sleepFn=sleep){
  let remaining=Math.max(0,Number(ms)||0);
  while(remaining>0){
    const chunk=Math.min(remaining,10000);
    await sleepFn(chunk);
    remaining-=chunk;
    await trace?.heartbeat?.();
  }
}

export async function awaitWithHeartbeat(promise,trace=null,sleepFn=sleep,heartbeatEveryMs=10000){
  let settled=false,value,failure;
  const observed=Promise.resolve(promise).then(
    result=>{settled=true;value=result},
    error=>{settled=true;failure=error}
  );
  while(!settled){
    await Promise.race([observed,sleepFn(Math.max(1000,heartbeatEveryMs))]);
    if(!settled)await trace?.heartbeat?.();
  }
  await observed;
  if(failure)throw failure;
  return value;
}

async function resilientJson(url,{headers={},timeoutMs=10000,retries=1,trace=null,baseBackoffMs=1000,maxBackoffMs=60000,fetchImpl=fetch,sleepFn=sleep}={}){
  let last=null;
  for(let attempt=0;attempt<=retries;attempt++){
    const controller=new AbortController();
    const timer=setTimeout(()=>controller.abort(),timeoutMs);
    try{
      await trace?.heartbeat?.();
      await trace?.externalCall?.(1);
      const r=await fetchImpl(url,{headers:{Accept:'application/json','User-Agent':'PikoFilm/5.0 PikoRelevancia',...headers},cache:'no-store',signal:controller.signal});
      const text=await r.text();
      let body=null;try{body=text?JSON.parse(text):null}catch{body=text}
      if(r.ok)return{ok:true,status:r.status,body};
      const retryable=r.status===429||r.status>=500;
      const retryAfter=r.headers?.get?.('retry-after')||null;
      last=Object.assign(new Error(`HTTP ${r.status}`),{status:r.status,retryable,retryAfter});
      if(!retryable||attempt>=retries)break;
      await sleepWithHeartbeat(retryDelayMs({attempt,retryAfter,baseBackoffMs,maxBackoffMs}),trace,sleepFn);
    }catch(error){
      last=error;
      if(attempt>=retries)break;
      await sleepWithHeartbeat(retryDelayMs({attempt,baseBackoffMs,maxBackoffMs}),trace,sleepFn);
    }finally{clearTimeout(timer)}
  }
  return{ok:false,error:String(last?.message||last||'fetch_failed'),status:Number(last?.status)||null,retry_after:last?.retryAfter||null};
}

function parseJsonSetting(value){
  if(!value)return null;
  if(typeof value==='object')return value;
  try{return JSON.parse(String(value))}catch{return null}
}
function mergeConfig(base,extra){
  const e=extra||{};
  const incomingWeights={...(e.weights||{})};
  delete incomingWeights.gdelt_es;
  return{
    ...base,...e,
    weights:{...base.weights,...incomingWeights},
    thresholds:{...base.thresholds,...(e.thresholds||{})},
  };
}
async function loadConfig(sql){
  try{
    const[row]=await sql`SELECT value FROM app_settings WHERE key='pikorelevance_v0' LIMIT 1`;
    return mergeConfig(DEFAULT_CONFIG,parseJsonSetting(row?.value));
  }catch{return DEFAULT_CONFIG}
}

async function loadInternal(sql,imdbId){
  const[row]=await sql`
    SELECT m.imdb_id,m.type,m.title,m.title_es,m.original_title,m.year,m.country,m.tmdb_id,
           m.final_rating,m.pikoscore_confidence,m.source_status,
           tr.normalized_rating imdb_rating,tr.votes imdb_votes
    FROM movies m
    LEFT JOIN LATERAL(
      SELECT normalized_rating,votes
      FROM title_ratings
      WHERE imdb_id=m.imdb_id AND source='imdb' AND status='available'
      ORDER BY fetched_at DESC NULLS LAST LIMIT 1
    ) tr ON true
    WHERE m.imdb_id=${imdbId} LIMIT 1`;
  return row||null;
}

async function loadOmdb(imdbId,{trace}={}){
  const key=process.env.OMDB_API_KEY||process.env.OMDB_APIKEY||process.env.OMDB_KEY;
  if(!key)return{status:'unavailable',reason:'missing_key'};
  const u=new URL('https://www.omdbapi.com/');
  u.searchParams.set('apikey',key);u.searchParams.set('i',imdbId);u.searchParams.set('plot','short');u.searchParams.set('r','json');
  const r=await resilientJson(u.toString(),{timeoutMs:10000,retries:1,trace});
  if(!r.ok)return{status:'error',reason:r.error};
  if(r.body?.Response==='False')return{status:'not_found',reason:r.body?.Error||'not_found'};
  const votes=Number(String(r.body?.imdbVotes||'').replace(/[^0-9]/g,''));
  const rating=Number(r.body?.imdbRating);
  const year=Number(String(r.body?.Year||'').match(/(19|20)\d{2}/)?.[0]);
  return{status:'ok',title:r.body?.Title||null,year:Number.isFinite(year)?year:null,type:String(r.body?.Type||'').toLowerCase()==='series'?'Serie':null,imdb_rating:Number.isFinite(rating)?rating:null,imdb_votes:Number.isFinite(votes)?votes:null};
}

async function tmdbFind(imdbId,{trace}={}){
  const token=process.env.TMDB_API_TOKEN;
  if(!token)return{status:'unavailable',reason:'missing_key'};
  const u=new URL(`https://api.themoviedb.org/3/find/${encodeURIComponent(imdbId)}`);
  u.searchParams.set('external_source','imdb_id');
  const r=await resilientJson(u.toString(),{headers:{Authorization:`Bearer ${token}`},timeoutMs:10000,retries:1,trace});
  if(!r.ok)return{status:'error',reason:r.error};
  const tv=Array.isArray(r.body?.tv_results)?r.body.tv_results[0]:null;
  return tv?{status:'ok',tmdb_id:String(tv.id),title:tv.name||tv.original_name||null,year:Number(String(tv.first_air_date||'').slice(0,4))||null}:{status:'not_found'};
}

const providerNames=block=>uniq(['flatrate','free','ads','buy','rent'].flatMap(k=>(block?.[k]||[]).map(x=>x?.provider_name)));
const streamingProviders=block=>uniq(['flatrate','free','ads'].flatMap(k=>(block?.[k]||[]).map(x=>x?.provider_name)));

async function tmdbSeries(tmdbId,{trace}={}){
  const token=process.env.TMDB_API_TOKEN;
  if(!token||!tmdbId)return{status:'unavailable',reason:!token?'missing_key':'missing_tmdb_id'};
  const u=new URL(`https://api.themoviedb.org/3/tv/${encodeURIComponent(tmdbId)}`);
  u.searchParams.set('language','es-ES');
  u.searchParams.set('append_to_response','watch/providers,translations');
  const r=await resilientJson(u.toString(),{headers:{Authorization:`Bearer ${token}`},timeoutMs:12000,retries:1,trace});
  if(!r.ok)return{status:'error',reason:r.error};
  const d=r.body||{},all=d?.['watch/providers']?.results||{},es=all.ES||null;
  const countries=Object.keys(all).filter(code=>providerNames(all[code]).length>0);
  const esProviders=providerNames(es),esStreaming=streamingProviders(es);
  const translations=Array.isArray(d?.translations?.translations)?d.translations.translations:[];
  const hasSpanishTranslation=translations.some(x=>String(x?.iso_639_1||'').toLowerCase()==='es');
  return{
    status:'ok',tmdb_id:String(tmdbId),name:d.name||null,original_name:d.original_name||null,
    first_air_date:d.first_air_date||null,last_air_date:d.last_air_date||null,
    original_language:d.original_language||null,origin_country:uniq(d.origin_country),
    series_status:d.status||null,popularity:Number(d.popularity)||0,
    seasons:Number(d.number_of_seasons)||0,episodes:Number(d.number_of_episodes)||0,
    es:{any:esProviders.length>0,streaming:esStreaming.length>0,providers:esProviders,streaming_providers:esStreaming},
    provider_countries:countries.length,provider_country_codes:countries,
    spanish_translation:hasSpanishTranslation,
  };
}

async function watchmodeSpain(imdbId,{trace}={}){
  const key=process.env.WATCHMODE_API_KEY;
  if(!key)return{status:'unavailable',reason:'missing_key'};
  const search=new URL('https://api.watchmode.com/v1/search/');
  search.searchParams.set('apiKey',key);search.searchParams.set('search_field','imdb_id');search.searchParams.set('search_value',imdbId);
  const a=await resilientJson(search.toString(),{timeoutMs:10000,retries:1,trace});
  if(!a.ok)return{status:'error',reason:a.error};
  const list=a.body?.title_results||a.body?.results||[];
  const hit=Array.isArray(list)?list[0]:null,id=hit?.id;
  if(!id)return{status:'ok',found:false,any:false,streaming:false,providers:[]};
  const sources=new URL(`https://api.watchmode.com/v1/title/${encodeURIComponent(id)}/sources/`);
  sources.searchParams.set('apiKey',key);sources.searchParams.set('regions','ES');
  const b=await resilientJson(sources.toString(),{timeoutMs:10000,retries:1,trace});
  if(!b.ok)return{status:'error',reason:b.error,watchmode_id:id};
  const rows=Array.isArray(b.body)?b.body:(b.body?.sources||[]);
  const es=rows.filter(x=>!x?.region||String(x.region).toUpperCase()==='ES');
  const providers=uniq(es.map(x=>x?.name||x?.source_name||x?.source));
  const streamTypes=new Set(['sub','subscription','flatrate','free','ads','tve','tv_everywhere']);
  const streaming=es.some(x=>streamTypes.has(String(x?.type||x?.format||x?.source_type||'').toLowerCase()));
  return{status:'ok',found:true,watchmode_id:id,any:es.length>0,streaming,providers,source_count:es.length};
}

async function wikimediaSpain(imdbId,{trace}={}){
  let hit;
  try{hit=await lookupWikidataByImdb(imdbId,{timeoutMs:30000,retries:2,baseBackoffMs:2000,maxBackoffMs:30000,trace})}catch(error){return{status:'error',reason:String(error?.message||error),status_code:Number(error?.status)||null,retry_after:error?.retryAfter||null}}
  if(!hit?.found||!hit?.qid)return{status:'ok',wikidata:false,eswiki:false,pageviews_90d:0};
  const entity=await resilientJson(`https://www.wikidata.org/wiki/Special:EntityData/${encodeURIComponent(hit.qid)}.json`,{timeoutMs:20000,retries:2,trace,baseBackoffMs:1500,maxBackoffMs:30000});
  if(!entity.ok)return{status:'error',reason:entity.error,qid:hit.qid};
  const title=entity.body?.entities?.[hit.qid]?.sitelinks?.eswiki?.title||null;
  if(!title)return{status:'ok',wikidata:true,qid:hit.qid,eswiki:false,pageviews_90d:0};
  const end=new Date();end.setUTCDate(end.getUTCDate()-1);
  const start=new Date(end);start.setUTCDate(start.getUTCDate()-89);
  const f=d=>d.toISOString().slice(0,10).replace(/-/g,'');
  const pvUrl=`https://wikimedia.org/api/rest_v1/metrics/pageviews/per-article/es.wikipedia/all-access/user/${encodeURIComponent(title.replace(/ /g,'_'))}/daily/${f(start)}/${f(end)}`;
  const pv=await resilientJson(pvUrl,{timeoutMs:20000,retries:2,trace,baseBackoffMs:1500,maxBackoffMs:30000});
  if(!pv.ok)return{status:'ok',wikidata:true,qid:hit.qid,eswiki:true,title,pageviews_90d:null,pageviews_status:'error',pageviews_error:pv.error};
  const views=(pv.body?.items||[]).reduce((sum,x)=>sum+(Number(x?.views)||0),0);
  return{status:'ok',wikidata:true,qid:hit.qid,eswiki:true,title,pageviews_90d:views,pageviews_status:'ok'};
}

export const MEDIACLOUD_ES_COLLECTION_ID=String(process.env.MEDIACLOUD_ES_COLLECTION_ID||'34412356');
export const MEDIACLOUD_MIN_INTERVAL_MS=Math.max(30000,Number(process.env.PIKORELEVANCE_MEDIACLOUD_MIN_INTERVAL_MS)||31000);
let mediaCloudQueue=Promise.resolve(),mediaCloudLastStartedAt=0;

async function withMediaCloudRateLimit(trace,fn){
  let release;
  const previous=mediaCloudQueue;
  mediaCloudQueue=new Promise(resolve=>{release=resolve});
  await awaitWithHeartbeat(previous,trace);
  try{
    const waitMs=Math.max(0,MEDIACLOUD_MIN_INTERVAL_MS-(Date.now()-mediaCloudLastStartedAt));
    if(waitMs)await sleepWithHeartbeat(waitMs,trace);
    mediaCloudLastStartedAt=Date.now();
    return await fn();
  }finally{release()}
}

function mediaCloudPhrase(value){
  return String(value||'').replace(/["\\]/g,' ').replace(/\s+/g,' ').trim().slice(0,160);
}

export function buildMediaCloudQuery(title,originalTitle){
  const names=uniq([title,originalTitle].map(mediaCloudPhrase)).slice(0,2);
  if(!names.length)return null;
  const titleBlock=names.length===1?`"${names[0]}"`:`("${names[0]}" OR "${names[1]}")`;
  return `${titleBlock} AND language:es`;
}

async function mediaCloudSpain({title,originalTitle,trace}={}){
  const key=process.env.MEDIACLOUD_API_KEY;
  if(!key)return{status:'unavailable',reason:'missing_key'};
  const query=buildMediaCloudQuery(title,originalTitle);
  if(!query)return{status:'unavailable',reason:'missing_title'};
  const end=new Date();end.setUTCDate(end.getUTCDate()-1);
  const start=new Date(end);start.setUTCDate(start.getUTCDate()-89);
  const day=d=>d.toISOString().slice(0,10);
  const u=new URL('https://search.mediacloud.org/api/search/total-count');
  u.searchParams.set('q',query);
  u.searchParams.set('start',day(start));
  u.searchParams.set('end',day(end));
  u.searchParams.set('platform','onlinenews-mediacloud');
  u.searchParams.set('cs',MEDIACLOUD_ES_COLLECTION_ID);
  const r=await withMediaCloudRateLimit(trace,()=>resilientJson(u.toString(),{
    headers:{Authorization:`Token ${key}`},
    timeoutMs:60000,
    retries:2,
    trace,
    baseBackoffMs:30000,
    maxBackoffMs:120000,
  }));
  if(!r.ok)return{status:'error',reason:r.error,status_code:r.status,retry_after:r.retry_after};
  const mentions=Number(r.body?.count);
  if(!Number.isFinite(mentions)||mentions<0)return{status:'error',reason:'invalid_count_response'};
  return{
    status:'ok',
    mentions,
    collection_id:MEDIACLOUD_ES_COLLECTION_ID,
    query,
    start_date:day(start),
    end_date:day(end),
  };
}

const points={
  linear:(value,min,max,weight)=>clamp((Number(value)-min)/(max-min),0,1)*weight,
  votes:(v,w)=>{const n=Number(v)||0;if(n>=250000)return w;if(n>=100000)return w*.9;if(n>=50000)return w*.8;if(n>=25000)return w*.7;if(n>=10000)return w*.5;if(n>=5000)return w*.25;return 0},
  pageviews:(v,w)=>{const n=Number(v)||0;if(n>=100000)return w;if(n>=25000)return w*.8;if(n>=5000)return w*.6;if(n>=1000)return w*.35;if(n>0)return w*.15;return 0},
  press:(v,w)=>{const n=Number(v)||0;if(n>=20)return w;if(n>=10)return w*.85;if(n>=5)return w*.65;if(n>=2)return w*.4;if(n===1)return w*.2;return 0},
  reach:(v,w)=>{const n=Number(v)||0;if(n>=30)return w;if(n>=20)return w*.85;if(n>=10)return w*.7;if(n>=5)return w*.5;if(n>=2)return w*.3;if(n===1)return w*.15;return 0},
  popularity:(v,w)=>{const n=Number(v)||0;if(n>=100)return w;if(n>=50)return w*.85;if(n>=25)return w*.65;if(n>=10)return w*.45;if(n>=5)return w*.25;if(n>0)return w*.1;return 0},
};

function addFactor(factors,key,{weight,available,points:value,evidence}){
  factors.push({key,weight:Number(weight)||0,available:Boolean(available),points:available?clamp(value,0,Number(weight)||0):null,evidence:evidence??null});
}
function recommendationFor(score,confidence,t){
  if(confidence<Number(t.min_confidence||60))return'datos_insuficientes';
  if(score>=Number(t.very_high||80))return'muy_alta';
  if(score>=Number(t.high||65))return'alta';
  if(score>=Number(t.medium||50))return'remojo';
  if(score>=Number(t.low||35))return'baja';
  return'muy_baja';
}

export function scorePikoRelevanceV0(input,config=DEFAULT_CONFIG){
  const c=mergeConfig(DEFAULT_CONFIG,config),w=c.weights,f=[],internal=input.internal||{},omdb=input.omdb||{},tmdb=input.tmdb||{},wm=input.watchmode||{},wiki=input.wikimedia||{},mediacloud=input.mediacloud||{};
  const piko=Number(internal.final_rating);
  addFactor(f,'pikoscore',{weight:w.pikoscore,available:Number.isFinite(piko)&&piko>0,points:points.linear(piko,5,9.5,w.pikoscore),evidence:piko||null});
  const imdbRating=Number(internal.imdb_rating??omdb.imdb_rating);
  addFactor(f,'imdb_rating',{weight:w.imdb_rating,available:Number.isFinite(imdbRating)&&imdbRating>0,points:points.linear(imdbRating,5,9,w.imdb_rating),evidence:imdbRating||null});
  const imdbVotes=Number(internal.imdb_votes??omdb.imdb_votes);
  addFactor(f,'imdb_votes',{weight:w.imdb_votes,available:Number.isFinite(imdbVotes)&&imdbVotes>=0,points:points.votes(imdbVotes,w.imdb_votes),evidence:imdbVotes||0});

  const tmdbOk=tmdb.status==='ok';
  const tmdbSpainPoints=tmdbOk?(tmdb.es?.streaming?w.tmdb_es:tmdb.es?.any?w.tmdb_es*.55:0):0;
  addFactor(f,'tmdb_es',{weight:w.tmdb_es,available:tmdbOk,points:tmdbSpainPoints,evidence:tmdbOk?tmdb.es:null});

  const wmOk=wm.status==='ok';
  const wmSpainPoints=wmOk?(wm.streaming?w.watchmode_es:wm.any?w.watchmode_es*.55:0):0;
  addFactor(f,'watchmode_es',{weight:w.watchmode_es,available:wmOk,points:wmSpainPoints,evidence:wmOk?{any:wm.any,streaming:wm.streaming,providers:wm.providers}:null});

  const wikiOk=wiki.status==='ok';
  addFactor(f,'eswiki',{weight:w.eswiki,available:wikiOk,points:wikiOk&&wiki.eswiki?w.eswiki:0,evidence:wikiOk?{exists:wiki.eswiki,title:wiki.title||null}:null});
  const pvAvailable=wikiOk&&wiki.eswiki&&wiki.pageviews_status!=='error';
  addFactor(f,'eswiki_pageviews',{weight:w.eswiki_pageviews,available:wikiOk&&(wiki.eswiki===false||pvAvailable),points:wiki.eswiki?points.pageviews(wiki.pageviews_90d,w.eswiki_pageviews):0,evidence:wikiOk?wiki.pageviews_90d:null});

  const mediaCloudOk=mediacloud.status==='ok';
  addFactor(f,'mediacloud_es',{weight:w.mediacloud_es,available:mediaCloudOk,points:points.press(mediacloud.mentions,w.mediacloud_es),evidence:mediaCloudOk?{mentions:mediacloud.mentions,collection_id:mediacloud.collection_id,query:mediacloud.query,start_date:mediacloud.start_date,end_date:mediacloud.end_date}:null});

  addFactor(f,'international_reach',{weight:w.international_reach,available:tmdbOk,points:points.reach(tmdb.provider_countries,w.international_reach),evidence:tmdbOk?tmdb.provider_countries:null});
  addFactor(f,'tmdb_popularity',{weight:w.tmdb_popularity,available:tmdbOk,points:points.popularity(tmdb.popularity,w.tmdb_popularity),evidence:tmdbOk?tmdb.popularity:null});

  const status=String(tmdb.series_status||'').toLowerCase(),year=Number(String(tmdb.first_air_date||'').slice(0,4)||internal.year||omdb.year),age=year?Math.max(0,new Date().getUTCFullYear()-year):null;
  let momentum=0;if(['returning series','in production','planned'].includes(status))momentum=w.momentum;else if(status==='ended'&&age!=null&&age<=3)momentum=w.momentum*.65;else if(status==='canceled'&&age!=null&&age<=3)momentum=w.momentum*.3;else if(age!=null&&age<=1)momentum=w.momentum*.5;
  addFactor(f,'momentum',{weight:w.momentum,available:tmdbOk,points:momentum,evidence:tmdbOk?{status:tmdb.series_status,year,age}:null});

  addFactor(f,'origin_es',{weight:w.origin_es,available:tmdbOk,points:tmdb.origin_country?.includes('ES')?w.origin_es:0,evidence:tmdbOk?tmdb.origin_country:null});
  addFactor(f,'language_es',{weight:w.language_es,available:tmdbOk,points:String(tmdb.original_language||'').toLowerCase()==='es'?w.language_es:0,evidence:tmdbOk?tmdb.original_language:null});
  addFactor(f,'spanish_translation',{weight:w.spanish_translation,available:tmdbOk,points:tmdb.spanish_translation?w.spanish_translation:0,evidence:tmdbOk?Boolean(tmdb.spanish_translation):null});

  const availableWeight=f.filter(x=>x.available).reduce((s,x)=>s+x.weight,0),earned=f.filter(x=>x.available).reduce((s,x)=>s+(Number(x.points)||0),0);
  const score=availableWeight>0?Math.round((earned/availableWeight)*1000)/10:0;
  const totalWeight=f.reduce((s,x)=>s+x.weight,0)||100;
  const confidence=Math.round((availableWeight/totalWeight)*1000)/10;
  return{version:PIKORELEVANCE_VERSION,score,confidence,recommendation:recommendationFor(score,confidence,c.thresholds),available_weight:availableWeight,total_weight:totalWeight,factors:f};
}

export async function computePikoRelevanceCanonical(sql,imdbId,{trace=null}={}){
  const id=String(imdbId||'').trim();
  if(!/^tt\d+$/.test(id))throw Object.assign(new Error('IMDb ID no válido'),{permanent:true,processStep:'validate'});
  const config=await loadConfig(sql),internal=await loadInternal(sql,id),omdb=await loadOmdb(id,{trace});
  let tmdbId=internal?.tmdb_id||null,find=null;
  if(!tmdbId){find=await tmdbFind(id,{trace});if(find.status==='ok')tmdbId=find.tmdb_id}
  const tmdb=await tmdbSeries(tmdbId,{trace});
  const title=internal?.title_es||internal?.title||omdb?.title||tmdb?.name||find?.title||null;
  const originalTitle=internal?.original_title||tmdb?.original_name||omdb?.title||title;
  const settled=await Promise.allSettled([
    watchmodeSpain(id,{trace}),
    wikimediaSpain(id,{trace}),
    mediaCloudSpain({title,originalTitle,trace}),
  ]);
  const pick=(x,name)=>x.status==='fulfilled'?x.value:{status:'error',reason:String(x.reason?.message||x.reason||`${name}_failed`)};
  const watchmode=pick(settled[0],'watchmode'),wikimedia=pick(settled[1],'wikimedia'),mediacloud=pick(settled[2],'mediacloud');
  const basic={imdb_id:id,title,original_title:originalTitle,year:internal?.year||omdb?.year||find?.year||Number(String(tmdb?.first_air_date||'').slice(0,4))||null,type:internal?.type||omdb?.type||'Serie'};
  const input={internal:internal||{},omdb,tmdb,watchmode,wikimedia,mediacloud};
  const scored=scorePikoRelevanceV0(input,config),assessedAt=nowIso(),next=new Date(Date.now()+Number(config.cacheDays||30)*86400000).toISOString();
  const sourceHealth={omdb:omdb.status,tmdb:tmdb.status,watchmode:watchmode.status,wikimedia:wikimedia.status,mediacloud:mediacloud.status};
  await sql`
    INSERT INTO series_relevance_assessments(imdb_id,formula_version,score,confidence,recommendation,title_snapshot,evidence,factors,source_health,assessed_at,next_review_at,updated_at)
    VALUES(${id},${scored.version},${scored.score},${scored.confidence},${scored.recommendation},${title},${JSON.stringify({basic,tmdb,watchmode,wikimedia,mediacloud,omdb})}::jsonb,${JSON.stringify(scored.factors)}::jsonb,${JSON.stringify(sourceHealth)}::jsonb,now(),${next}::timestamptz,now())
    ON CONFLICT(imdb_id) DO UPDATE SET formula_version=EXCLUDED.formula_version,score=EXCLUDED.score,confidence=EXCLUDED.confidence,recommendation=EXCLUDED.recommendation,title_snapshot=EXCLUDED.title_snapshot,evidence=EXCLUDED.evidence,factors=EXCLUDED.factors,source_health=EXCLUDED.source_health,assessed_at=now(),next_review_at=EXCLUDED.next_review_at,updated_at=now()`;
  await trace?.event?.({eventType:'step_completed',step:'pikorelevancia',entityType:'series',entityId:id,message:`PikoRelevancia ${scored.score}/100 · confianza ${scored.confidence}%`,data:{score:scored.score,confidence:scored.confidence,recommendation:scored.recommendation,source_health:sourceHealth}});
  return{technicalStatus:'succeeded',functionalResult:'updated',metrics:{score:scored.score,confidence:scored.confidence,sources_ok:Object.values(sourceHealth).filter(x=>x==='ok').length},after:{...basic,pikorelevancia:scored.score,confidence:scored.confidence,recommendation:scored.recommendation,source_health:sourceHealth,factors:scored.factors,next_review_at:next},message:`PikoRelevancia calculada: ${scored.score}/100 · ${scored.recommendation}`};
}
