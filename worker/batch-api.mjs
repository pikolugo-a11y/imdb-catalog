import {neon} from '@neondatabase/serverless';

const DATABASE_URL=process.env.DATABASE_URL;
const TMDB_API_TOKEN=process.env.TMDB_API_TOKEN;
if(!DATABASE_URL)throw new Error('DATABASE_URL no está configurada');
const sql=neon(DATABASE_URL);
const WORKER_ID=String(process.env.BATCH_API_WORKER_ID||`api-${process.pid}`).slice(0,80);
const POLL_MS=Math.max(2000,Number(process.env.BATCH_POLL_MS)||5000);
const LEASE_SECONDS=Math.max(30,Math.min(300,Number(process.env.BATCH_LEASE_SECONDS)||120));
const SOURCE='tmdb';
const STAGE='DATA_INCOMPLETE';
let stopping=false;
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const text=e=>String(e?.message||e||'Error desconocido').slice(0,1000);

async function runtimeOpen(){const[r]=await sql`SELECT paused FROM batch_runtime_control WHERE singleton=true`;return r&&!r.paused;}
async function sourceConfig(){const[r]=await sql`SELECT source,enabled,max_concurrency,min_interval_ms,daily_budget,breaker_state,blocked_until,consecutive_errors,updated_at FROM batch_source_limits WHERE source=${SOURCE}`;return r||null;}
async function usedToday(){const[r]=await sql`SELECT count(*)::int n FROM batch_jobs WHERE finished_at>=date_trunc('day',now()) AND result_summary->>'source'=${SOURCE} AND status='done'`;return Number(r?.n||0)}
async function sourceReady(){
  const cfg=await sourceConfig();if(!cfg||!cfg.enabled)return{ok:false,reason:'disabled'};
  if(cfg.breaker_state==='open'&&cfg.blocked_until&&new Date(cfg.blocked_until)>new Date())return{ok:false,reason:'breaker'};
  if(cfg.daily_budget!=null&&await usedToday()>=Number(cfg.daily_budget))return{ok:false,reason:'budget'};
  const wait=Math.max(0,Number(cfg.min_interval_ms||0)-(Date.now()-new Date(cfg.updated_at).getTime()));
  if(wait>0)return{ok:false,reason:'interval',wait};
  return{ok:true,cfg};
}
async function markSourceSuccess(){await sql`UPDATE batch_source_limits SET consecutive_errors=0,breaker_state='closed',blocked_until=NULL,updated_at=now() WHERE source=${SOURCE}`;}
async function markSourceFailure(error){
  const status=Number(error?.status||0),hard=[401,403,429].includes(status);
  const[r]=await sql`UPDATE batch_source_limits SET consecutive_errors=consecutive_errors+1,updated_at=now() WHERE source=${SOURCE} RETURNING consecutive_errors`;
  const n=Number(r?.consecutive_errors||1);if(hard||n>=5){const mins=status===429?60:15;await sql`UPDATE batch_source_limits SET breaker_state='open',blocked_until=now()+(${mins}||' minutes')::interval,updated_at=now() WHERE source=${SOURCE}`;}
}

async function leaseOne(){
  if(!(await runtimeOpen()))return null;
  const ready=await sourceReady();if(!ready.ok){if(ready.wait)await sleep(Math.min(ready.wait,POLL_MS));return null;}
  const rows=await sql`UPDATE batch_jobs j SET status='leased',worker_id=${WORKER_ID},leased_until=now()+(${LEASE_SECONDS}||' seconds')::interval,attempt=j.attempt+1,started_at=COALESCE(j.started_at,now()),updated_at=now()
    WHERE j.id=(SELECT q.id FROM batch_jobs q JOIN batch_runs r ON r.id=q.run_id JOIN catalog_lifecycle cl ON cl.imdb_id=q.entity_id
      WHERE q.status IN('queued','retry_wait') AND q.available_at<=now() AND (q.leased_until IS NULL OR q.leased_until<now())
        AND r.status IN('queued','running') AND q.stage=${STAGE} AND cl.lifecycle_state=${STAGE}
      ORDER BY q.priority DESC,q.created_at,q.id LIMIT 1 FOR UPDATE SKIP LOCKED)
    RETURNING j.id,j.run_id,j.entity_id,j.stage,j.attempt`;
  const job=rows[0];if(!job)return null;
  await sql`UPDATE batch_runs SET status='running',started_at=COALESCE(started_at,now()),updated_at=now() WHERE id=${job.run_id} AND status='queued'`;
  return job;
}

async function tmdbJson(path){
  if(!TMDB_API_TOKEN)throw Object.assign(new Error('TMDB_API_TOKEN no está configurado en Railway'),{permanent:true});
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),15000);
  try{const r=await fetch(`https://api.themoviedb.org/3${path}`,{headers:{Authorization:`Bearer ${TMDB_API_TOKEN}`,Accept:'application/json'},signal:controller.signal});if(!r.ok){const e=new Error(`TMDb HTTP ${r.status}`);e.status=r.status;throw e}return await r.json()}finally{clearTimeout(timer)}
}
function mediaType(type){return type==='Serie'||type==='Miniserie'?'tv':'movie'}
async function fetchTmdb(row){
  let kind=mediaType(row.type),id=row.tmdb_id?String(row.tmdb_id):null;
  if(!id){const f=await tmdbJson(`/find/${encodeURIComponent(row.imdb_id)}?external_source=imdb_id&language=es-ES`);const movie=f?.movie_results?.[0],tv=f?.tv_results?.[0],hit=movie||tv;if(!hit)throw Object.assign(new Error('TMDb no encontró el título'),{permanent:true});kind=movie?'movie':'tv';id=String(hit.id)}
  const d=await tmdbJson(`/${kind}/${id}?language=es-ES&append_to_response=external_ids`);
  return{kind,id,title:d.title||d.name||null,original_title:d.original_title||d.original_name||null,year:Number(String(d.release_date||d.first_air_date||'').slice(0,4))||null,runtime:d.runtime||d.episode_run_time?.[0]||null,rating:d.vote_average??null,votes:d.vote_count??null,poster:d.poster_path||null,backdrop:d.backdrop_path||null,overview:d.overview||null,language:d.original_language||null,release_date:d.release_date||d.first_air_date||null,country:(d.production_countries||d.origin_country||[]).map(x=>x.name||x).filter(Boolean).join(', ')||null};
}
async function execute(job){
  const[row]=await sql`SELECT imdb_id,type,title,title_es,year,tmdb_id,source_status FROM movies WHERE imdb_id=${job.entity_id}`;if(!row)throw Object.assign(new Error('Título no encontrado'),{permanent:true});
  const d=await fetchTmdb(row);await markSourceSuccess();
  await sql`UPDATE movies SET tmdb_id=${d.id},tmdb_rating=${d.rating},tmdb_votes=${d.votes},tmdb_url=${`https://www.themoviedb.org/${d.kind}/${d.id}`},title_es=COALESCE(title_es,${d.title}),original_title=COALESCE(original_title,${d.original_title}),year=COALESCE(year,${d.year}),runtime=COALESCE(runtime,${d.runtime}),country=COALESCE(country,${d.country}),poster_path=COALESCE(${d.poster},poster_path),backdrop_path=COALESCE(${d.backdrop},backdrop_path),artwork_synced_at=now(),artwork_source='tmdb',source_status=COALESCE(source_status,'{}'::jsonb)||jsonb_build_object('tmdb','ok','tmdb_batch_at',now()),source_generated_at=now(),synced_at=now() WHERE imdb_id=${job.entity_id}`;
  await sql`INSERT INTO movie_metadata(imdb_id,overview,original_language,release_date,metadata_enriched_at,metadata_source) VALUES(${job.entity_id},${d.overview},${d.language},${d.release_date||null},now(),'tmdb') ON CONFLICT(imdb_id) DO UPDATE SET overview=COALESCE(EXCLUDED.overview,movie_metadata.overview),original_language=COALESCE(EXCLUDED.original_language,movie_metadata.original_language),release_date=COALESCE(EXCLUDED.release_date,movie_metadata.release_date),metadata_enriched_at=now(),metadata_source='tmdb'`;
  return{source:SOURCE,tmdb_id:d.id,media_type:d.kind,rating:d.rating,votes:d.votes,lifecycle_reconcile_required:true};
}
async function finish(job,result){await sql`UPDATE batch_jobs SET status='done',result_summary=${JSON.stringify(result)}::jsonb,error_class=NULL,error_message=NULL,finished_at=now(),leased_until=NULL,updated_at=now() WHERE id=${job.id} AND worker_id=${WORKER_ID}`;const[c]=await sql`SELECT count(*) FILTER(WHERE status IN('queued','retry_wait','leased','running'))::int pending FROM batch_jobs WHERE run_id=${job.run_id}`;if(Number(c?.pending||0)===0)await sql`UPDATE batch_runs SET status='completed',finished_at=now(),updated_at=now() WHERE id=${job.run_id} AND status IN('queued','running')`;}
async function fail(job,error){await markSourceFailure(error).catch(()=>{});const permanent=Boolean(error?.permanent)||[401,403].includes(Number(error?.status||0)),retry=!permanent&&Number(job.attempt||1)<3;await sql`UPDATE batch_jobs SET status=${retry?'retry_wait':'failed'},error_class=${error?.name||'Error'},error_message=${text(error)},available_at=CASE WHEN ${retry} THEN now()+((30*power(2,GREATEST(0,${Number(job.attempt||1)}-1)))||' seconds')::interval ELSE available_at END,leased_until=NULL,worker_id=NULL,finished_at=CASE WHEN ${retry} THEN NULL ELSE now() END,updated_at=now() WHERE id=${job.id}`;}

async function loop(){console.log(`[batch-api] worker=${WORKER_ID} started; source=${SOURCE}; stage=${STAGE}; concurrency=1`);while(!stopping){try{const job=await leaseOne();if(!job){await sleep(POLL_MS);continue}try{const result=await execute(job);await finish(job,result);console.log(`[batch-api] done job=${job.id} ${job.entity_id} tmdb=${result.tmdb_id}`)}catch(e){await fail(job,e);console.error(`[batch-api] failed job=${job.id} ${job.entity_id}: ${text(e)}`)}}catch(e){console.error(`[batch-api] loop: ${text(e)}`);await sleep(POLL_MS)}}console.log('[batch-api] stopped')}
for(const s of ['SIGTERM','SIGINT'])process.on(s,()=>{stopping=true});
await loop();
