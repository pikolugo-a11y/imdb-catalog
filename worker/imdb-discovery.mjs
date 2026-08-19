import {neon} from '@neondatabase/serverless';
import {createGunzip} from 'node:zlib';
import {Readable} from 'node:stream';
import {createInterface} from 'node:readline';

const databaseUrl=process.env.DATABASE_URL;
if(!databaseUrl)throw new Error('Falta DATABASE_URL');
const sql=neon(databaseUrl);
const RATINGS='https://datasets.imdbws.com/title.ratings.tsv.gz';
const BASICS='https://datasets.imdbws.com/title.basics.tsv.gz';
const TMDB='https://api.themoviedb.org/3';
const WEEK_MS=7*24*60*60*1000;
const FORCE_ONCE=String(process.env.FORCE_DISCOVERY_ONCE||'false').toLowerCase()==='true';
const DEFAULTS={version:1,movie:{general:{minRating:6,minVotes:10000},spain:{minRating:6,minVotes:7500}},series:{general:{minRating:7,minVotes:5000},spain:{minRating:6.5,minVotes:4000}},excludedCountries:['Q668','IN'],excludeAdult:true};
const nowIso=()=>new Date().toISOString();
const isSeries=t=>t==='tvSeries'||t==='tvMiniSeries';

async function stream(url){const r=await fetch(url,{headers:{'User-Agent':'PikoFilm/2.0 personal-noncommercial-dataset-discovery'}});if(!r.ok||!r.body)throw new Error(`IMDb dataset HTTP ${r.status}: ${url}`);return Readable.fromWeb(r.body).pipe(createGunzip())}
async function getSettings(){const [r]=await sql`SELECT value FROM app_settings WHERE key='imdb_discovery_v1' LIMIT 1`;const x=r?.value||{};return {...DEFAULTS,...x,movie:{general:{...DEFAULTS.movie.general,...x?.movie?.general},spain:{...DEFAULTS.movie.spain,...x?.movie?.spain}},series:{general:{...DEFAULTS.series.general,...x?.series?.general},spain:{...DEFAULTS.series.spain,...x?.series?.spain}},excludedCountries:Array.isArray(x?.excludedCountries)?x.excludedCountries:DEFAULTS.excludedCountries}}
async function weeklyGuard(){const [last]=await sql`SELECT finished_at FROM pipeline_runs WHERE job_type='imdb_discovery' AND status='success' AND finished_at IS NOT NULL ORDER BY finished_at DESC LIMIT 1`;if(!last?.finished_at)return{allowed:true,lastSuccessAt:null,nextAllowedAt:null};const lastMs=new Date(last.finished_at).getTime(),nextMs=lastMs+WEEK_MS;return{allowed:Date.now()>=nextMs,lastSuccessAt:new Date(lastMs).toISOString(),nextAllowedAt:new Date(nextMs).toISOString()}}
async function startRun(source,extra={}){const [r]=await sql`INSERT INTO pipeline_runs(job_type,source,status,started_at,summary,created_at,updated_at) VALUES('imdb_discovery',${source},'running',now(),${JSON.stringify(extra)}::jsonb,now(),now()) RETURNING id`;return r.id}
async function finishRun(id,status,summary,counts={}){await sql`UPDATE pipeline_runs SET status=${status},finished_at=now(),processed_count=${counts.processed||0},added_count=${counts.added||0},updated_count=${counts.updated||0},skipped_count=${counts.skipped||0},error_count=${counts.errors||0},summary=${JSON.stringify(summary)}::jsonb,updated_at=now() WHERE id=${id}`}

async function loadKnown(){
  const [catalog,excluded,candidates]=await Promise.all([sql`SELECT imdb_id FROM movies`,sql`SELECT imdb_id FROM catalog_exclusions`,sql`SELECT imdb_id,eligibility_status,source_snapshot FROM catalog_candidates`]);
  return {catalog:new Set(catalog.map(x=>x.imdb_id)),excluded:new Set(excluded.map(x=>x.imdb_id)),candidates:new Map(candidates.map(x=>[x.imdb_id,x]))};
}

async function readRatings(settings){
  const absoluteRating=Math.min(settings.movie.general.minRating,settings.movie.spain.minRating,settings.series.general.minRating,settings.series.spain.minRating);
  const absoluteVotes=Math.min(settings.movie.general.minVotes,settings.movie.spain.minVotes,settings.series.general.minVotes,settings.series.spain.minVotes);
  const out=new Map();let scanned=0;const rl=createInterface({input:await stream(RATINGS),crlfDelay:Infinity});let head=true;
  for await(const line of rl){if(head){head=false;continue}scanned++;const[id,r,v]=line.split('\t'),rating=Number(r),votes=Number(v);if(rating>=absoluteRating&&votes>=absoluteVotes)out.set(id,{rating,votes})}
  return {ratings:out,scanned};
}

async function readBasics(ratings,settings,known){
  const out=[];let scanned=0,matched=0;const rl=createInterface({input:await stream(BASICS),crlfDelay:Infinity});let head=true;
  for await(const line of rl){if(head){head=false;continue}scanned++;const parts=line.split('\t'),id=parts[0],rating=ratings.get(id);if(!rating)continue;const type=parts[1];if(type!=='movie'&&!isSeries(type))continue;const isAdult=parts[4]==='1';if(settings.excludeAdult&&isAdult)continue;const year=Number(parts[5])||null,profile=type==='movie'?settings.movie:settings.series,general=rating.rating>=profile.general.minRating&&rating.votes>=profile.general.minVotes,spainZone=!general&&rating.rating>=profile.spain.minRating&&rating.votes>=profile.spain.minVotes;if(!general&&!spainZone)continue;if(known.catalog.has(id)||known.excluded.has(id))continue;const prior=known.candidates.get(id);if(prior?.source_snapshot?.manual===true&&prior?.source_snapshot?.manualActive!==false)continue;matched++;out.push({imdb_id:id,candidate_type:type,year,imdb_rating:rating.rating,imdb_votes:rating.votes,title:parts[2]==='\\N'?null:parts[2],originalTitle:parts[3]==='\\N'?null:parts[3],isAdult,general,spainZone})}
  return {candidates:out,scanned,matched};
}

async function wikidataCountries(ids){const map=new Map();for(let i=0;i<ids.length;i+=120){const batch=ids.slice(i,i+120),values=batch.map(x=>`"${x}"`).join(' '),query=`SELECT ?imdb ?country WHERE { VALUES ?imdb { ${values} } ?item wdt:P345 ?imdb; wdt:P495 ?country. }`,url=`https://query.wikidata.org/sparql?query=${encodeURIComponent(query)}&format=json`;try{const r=await fetch(url,{headers:{Accept:'application/sparql-results+json','User-Agent':'PikoFilm/2.0 personal non-commercial'}});if(!r.ok)continue;const j=await r.json();for(const b of j?.results?.bindings||[]){const id=b.imdb?.value,qid=b.country?.value?.split('/').pop();if(!id||!qid)continue;if(!map.has(id))map.set(id,new Set());map.get(id).add(qid)}}catch{}}return map}

async function tmdbCountry(imdbId,type){const token=process.env.TMDB_API_TOKEN;if(!token)return[];const headers={Authorization:`Bearer ${token}`,Accept:'application/json'};try{const f=await fetch(`${TMDB}/find/${imdbId}?external_source=imdb_id`,{headers});if(!f.ok)return[];const j=await f.json(),hit=type==='movie'?j.movie_results?.[0]:(j.tv_results?.[0]||j.movie_results?.[0]);if(!hit)return[];if(type!=='movie'&&Array.isArray(hit.origin_country)&&hit.origin_country.length)return hit.origin_country;const media=type==='movie'?'movie':'tv',d=await fetch(`${TMDB}/${media}/${hit.id}`,{headers});if(!d.ok)return[];const x=await d.json();return media==='movie'?(x.production_countries||[]).map(c=>c.iso_3166_1).filter(Boolean):(x.origin_country||[])}catch{return[]}}
async function pool(items,n,fn){let idx=0;await Promise.all(Array.from({length:Math.min(n,items.length)},async()=>{while(idx<items.length){const item=items[idx++];await fn(item)}}))}
async function resolveCountries(candidates,known){const map=new Map(),need=[];for(const c of candidates){const cached=known.candidates.get(c.imdb_id)?.source_snapshot?.countries;if(Array.isArray(cached)&&cached.length)map.set(c.imdb_id,new Set(cached));else need.push(c.imdb_id)}const wiki=await wikidataCountries(need);for(const[k,v]of wiki)map.set(k,v);const unresolved=candidates.filter(c=>!map.has(c.imdb_id)||map.get(c.imdb_id).size===0);await pool(unresolved.slice(0,800),8,async c=>{const codes=await tmdbCountry(c.imdb_id,c.candidate_type);if(codes.length)map.set(c.imdb_id,new Set(codes))});return map}

async function upsertBatch(rows){if(!rows.length)return;const payload=JSON.stringify(rows);await sql`
  INSERT INTO catalog_candidates(imdb_id,candidate_type,year,imdb_rating,imdb_votes,eligibility_status,first_seen_at,last_seen_at,became_eligible_at,last_evaluated_at,source_snapshot,created_at,updated_at)
  SELECT x.imdb_id,x.candidate_type,x.year,x.imdb_rating,x.imdb_votes,x.eligibility_status,now(),now(),CASE WHEN x.eligibility_status='eligible' THEN now() ELSE NULL END,now(),x.source_snapshot,now(),now()
  FROM jsonb_to_recordset(${payload}::jsonb) AS x(imdb_id text,candidate_type text,year int,imdb_rating double precision,imdb_votes int,eligibility_status text,source_snapshot jsonb)
  ON CONFLICT(imdb_id) DO UPDATE SET candidate_type=EXCLUDED.candidate_type,year=EXCLUDED.year,imdb_rating=EXCLUDED.imdb_rating,imdb_votes=EXCLUDED.imdb_votes,
    eligibility_status=CASE WHEN catalog_candidates.source_snapshot->>'manual'='true' AND COALESCE(catalog_candidates.source_snapshot->>'manualActive','true')='true' THEN catalog_candidates.eligibility_status ELSE EXCLUDED.eligibility_status END,
    last_seen_at=now(),became_eligible_at=CASE WHEN EXCLUDED.eligibility_status='eligible' THEN COALESCE(catalog_candidates.became_eligible_at,now()) ELSE catalog_candidates.became_eligible_at END,last_evaluated_at=now(),
    source_snapshot=CASE WHEN catalog_candidates.source_snapshot->>'manual'='true' AND COALESCE(catalog_candidates.source_snapshot->>'manualActive','true')='true' THEN catalog_candidates.source_snapshot ELSE EXCLUDED.source_snapshot END,updated_at=now()`}

async function main(){
  const guard=await weeklyGuard();
  if(!guard.allowed&&!FORCE_ONCE){const runId=await startRun('manual',{forceOnce:false});const summary={stage:'blocked',reason:'weekly_cooldown',lastSuccessAt:guard.lastSuccessAt,nextAllowedAt:guard.nextAllowedAt,forceOnce:false};await finishRun(runId,'failed',summary,{errors:1});throw new Error(`Discovery bloqueado por límite semanal. Próxima ejecución permitida: ${guard.nextAllowedAt}`)}
  const runId=await startRun(FORCE_ONCE?'manual_test_override':'manual',{forceOnce:FORCE_ONCE,weeklyGuardBypassed:FORCE_ONCE&&!guard.allowed}),started=Date.now();
  try{
    const settings=await getSettings(),known=await loadKnown(),ratingsPhase=await readRatings(settings),basicsPhase=await readBasics(ratingsPhase.ratings,settings,known),countryMap=await resolveCountries(basicsPhase.candidates,known),excluded=new Set(settings.excludedCountries||[]),rows=[];let general=0,spain=0,rejectedCountry=0,pendingCountry=0;
    for(const c of basicsPhase.candidates){const countries=[...(countryMap.get(c.imdb_id)||[])],isExcludedCountry=countries.some(x=>excluded.has(x)),isSpain=countries.some(x=>x==='ES'||x==='Q29');let eligibility='not_eligible',matchedRule=null,countryStatus=countries.length?'resolved':'pending';if(isExcludedCountry){eligibility='rejected';rejectedCountry++}else if(!countries.length){pendingCountry++}else if(c.general){eligibility='eligible';matchedRule='general';general++}else if(c.spainZone&&isSpain){eligibility='eligible';matchedRule='spain';spain++}
      rows.push({...c,eligibility_status:eligibility,source_snapshot:{title:c.title,originalTitle:c.originalTitle,isAdult:c.isAdult,matchedRule,discoveryVersion:'novedades-v1',rulesVersion:settings.version||1,countries,countryStatus,datasetRatings:RATINGS,datasetBasics:BASICS,discoveredAt:nowIso()}})}
    for(let i=0;i<rows.length;i+=500)await upsertBatch(rows.slice(i,i+500));
    await sql`UPDATE catalog_candidates SET eligibility_status='not_eligible',last_evaluated_at=now(),updated_at=now() WHERE source_snapshot->>'discoveryVersion'='novedades-v1' AND COALESCE(source_snapshot->>'manual','false')<>'true' AND eligibility_status IN('eligible','processing') AND last_seen_at < to_timestamp(${started/1000})`;
    const summary={settingsVersion:settings.version||1,elapsedSeconds:Math.round((Date.now()-started)/1000),forceOnce:FORCE_ONCE,weeklyGuardBypassed:FORCE_ONCE&&!guard.allowed,ratingsScanned:ratingsPhase.scanned,ratingsPreselected:ratingsPhase.ratings.size,basicsScanned:basicsPhase.scanned,potentialCandidates:basicsPhase.matched,generalEligible:general,spanishRescues:spain,rejectedCountry,pendingCountry,rowsUpserted:rows.length};
    await finishRun(runId,'success',summary,{processed:basicsPhase.matched,added:general+spain,skipped:rejectedCountry+pendingCountry});console.log(JSON.stringify(summary,null,2));
  }catch(e){await finishRun(runId,'failed',{forceOnce:FORCE_ONCE,error:e?.message||String(e)},{errors:1});throw e}
}
main().catch(e=>{console.error(e);process.exit(1)});