import {neon} from '@neondatabase/serverless';

const DATABASE_URL=process.env.DATABASE_URL;
if(!DATABASE_URL)throw new Error('DATABASE_URL no está configurada');
const sql=neon(DATABASE_URL);
const WORKER_ID=String(process.env.BATCH_WORKER_ID||`fast-${process.pid}`).slice(0,80);
const POLL_MS=Math.max(2000,Number(process.env.BATCH_POLL_MS)||5000);
const LEASE_SECONDS=Math.max(30,Math.min(300,Number(process.env.BATCH_LEASE_SECONDS)||120));
const ALLOWED_STAGES=new Set(['PIKOSCORE_PENDING']);
let stopping=false;
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const msg=e=>String(e?.message||e||'Error desconocido').slice(0,1000);

async function runtimeOpen(){const[r]=await sql`SELECT paused FROM batch_runtime_control WHERE singleton=true`;return r&&!r.paused;}

async function leaseOne(){
  if(!(await runtimeOpen()))return null;
  const rows=await sql`
    UPDATE batch_jobs j SET status='leased',worker_id=${WORKER_ID},leased_until=now()+(${LEASE_SECONDS}||' seconds')::interval,attempt=j.attempt+1,started_at=COALESCE(j.started_at,now()),updated_at=now()
    WHERE j.id=(
      SELECT q.id FROM batch_jobs q JOIN batch_runs r ON r.id=q.run_id
      WHERE q.status IN('queued','retry_wait') AND q.available_at<=now() AND (q.leased_until IS NULL OR q.leased_until<now())
        AND r.status IN('queued','running') AND q.stage='PIKOSCORE_PENDING'
      ORDER BY q.priority DESC,q.created_at,q.id LIMIT 1 FOR UPDATE SKIP LOCKED
    )
    RETURNING j.id,j.run_id,j.entity_id,j.stage,j.attempt`;
  const job=rows[0];if(!job)return null;
  await sql`UPDATE batch_runs SET status='running',started_at=COALESCE(started_at,now()),updated_at=now() WHERE id=${job.run_id} AND status='queued'`;
  return job;
}

function freshnessDays(row){const now=new Date(),release=row.release_date?new Date(row.release_date):null;let age=10;if(release&&!Number.isNaN(release.getTime()))age=Math.max(0,(now-release)/(365.25*86400000));else if(Number(row.year)>1800)age=Math.max(0,now.getUTCFullYear()-Number(row.year));return age<0.25?14:age<1?30:age<3?90:age<10?180:365;}
const clamp=(n,min,max)=>Math.max(min,Math.min(max,n));
const spanish=c=>/\b(spain|españa)\b/i.test(String(c||''));
function params(es){return es?{prior:{imdb:5.72,fa:5.12,tmdb:5.91},median:{imdb:807,fa:2160,tmdb:39},weight:{imdb:.30,fa:.45,tmdb:.25}}:{prior:{imdb:6.54,fa:5.72,tmdb:6.63},median:{imdb:21969,fa:2340,tmdb:490},weight:{imdb:.40,fa:.35,tmdb:.25}}}
function ageFactor(row){const d=freshnessDays(row);return d===14?.25:d===30?.35:d===90?.55:d===180?.8:1}
function adjusted(r,v,prior,median,mult){v=Math.max(0,Number(v)||0);const m=Math.max(1,median*mult),rating=Number(r)||prior,c=v/(v+m);return{value:(v*rating+m*prior)/(v+m),confidence:c}}
function compute(row){for(const k of ['imdb_rating','imdb_votes','fa_rating','fa_votes','tmdb_rating','tmdb_votes'])if(!(Number(row[k])>0))throw new Error(`Falta ${k}`);const p=params(spanish(row.country)),af=ageFactor(row),a={imdb:adjusted(row.imdb_rating,row.imdb_votes,p.prior.imdb,p.median.imdb,af),fa:adjusted(row.fa_rating,row.fa_votes,p.prior.fa,p.median.fa,af),tmdb:adjusted(row.tmdb_rating,row.tmdb_votes,p.prior.tmdb,p.median.tmdb,af)};let critic=0,signals=[];if(Number.isFinite(Number(row.metacritic_score)))signals.push(clamp((Number(row.metacritic_score)-60)/40,-1,1));if(Number.isFinite(Number(row.rotten_tomatoes_score)))signals.push(clamp((Number(row.rotten_tomatoes_score)-60)/40,-1,1));if(signals.length)critic=clamp(signals.reduce((x,y)=>x+y,0)/signals.length*.35,-.35,.35);const score=Number(clamp(a.imdb.value*p.weight.imdb+a.fa.value*p.weight.fa+a.tmdb.value*p.weight.tmdb+critic,0,10).toFixed(2));const vals=[a.imdb.value,a.fa.value,a.tmdb.value],mean=vals.reduce((x,y)=>x+y,0)/3,std=Math.sqrt(vals.reduce((s,x)=>s+(x-mean)**2,0)/3),vote=a.imdb.confidence*p.weight.imdb+a.fa.confidence*p.weight.fa+a.tmdb.confidence*p.weight.tmdb,confidence=Number((100*(.15+.85*vote)*Math.max(.55,1-Math.min(.45,std/3))).toFixed(1));return{score,confidence,critic:Number(critic.toFixed(3))}}

async function executePikoScore(job){
  const[r]=await sql`SELECT m.imdb_id,m.year,m.country,m.imdb_rating,m.imdb_votes,m.fa_rating,m.fa_votes,m.tmdb_rating,m.tmdb_votes,m.rotten_tomatoes_score,m.metacritic_score,m.ratings_refreshed_at,m.pikoscore_calculated_at,m.pikoscore_version,mm.release_date FROM movies m LEFT JOIN movie_metadata mm USING(imdb_id) WHERE m.imdb_id=${job.entity_id}`;
  if(!r)throw new Error('Título no encontrado');
  if(!r.ratings_refreshed_at)throw new Error('Las notas no están verificadas');
  const refreshed=new Date(r.ratings_refreshed_at);if(Number.isNaN(refreshed.getTime())||Date.now()-refreshed.getTime()>=freshnessDays(r)*86400000)throw new Error('Las notas están caducadas');
  const result=compute(r);
  await sql`UPDATE movies SET final_rating=${result.score},pikoscore_calculated_at=now(),pikoscore_version='2.0.0',pikoscore_confidence=${result.confidence},pikoscore_imdb_votes=${r.imdb_votes},pikoscore_fa_votes=${r.fa_votes},pikoscore_tmdb_votes=${r.tmdb_votes},pikoscore_critics_modifier=${result.critic},synced_at=now() WHERE imdb_id=${job.entity_id}`;
  return result;
}

async function recomputeSimpleLifecycle(imdbId){
  const[r]=await sql`SELECT m.imdb_id,m.type,m.pikoscore_calculated_at,m.pikoscore_version,pcs.status plex_status FROM movies m LEFT JOIN plex_catalog_status pcs USING(imdb_id) WHERE m.imdb_id=${imdbId}`;
  if(!r)return;
  let next='COMPLETE',reason=null;
  if(String(r.pikoscore_version)!=='2.0.0'||!r.pikoscore_calculated_at){next='PIKOSCORE_PENDING';reason='Datos completos; PikoScore pendiente o caducado'}
  else if(String(r.plex_status)==='in_plex'){
    if(r.type==='Serie'||r.type==='Miniserie'){next='SERIES_SYNC_PENDING';reason='Falta referencia oficial de serie'}
    else {next='MOVIE_FILE_PENDING';reason='Archivo físico pendiente de validar'}
  }
  await sql`UPDATE catalog_lifecycle SET previous_state=CASE WHEN lifecycle_state<>${next} THEN lifecycle_state ELSE previous_state END,lifecycle_state=${next},blocking_reason=${reason},state_changed_at=CASE WHEN lifecycle_state<>${next} THEN now() ELSE state_changed_at END,computed_at=now() WHERE imdb_id=${imdbId}`;
}

async function finish(job,result){
  await recomputeSimpleLifecycle(job.entity_id);
  await sql`UPDATE batch_jobs SET status='done',result_summary=${JSON.stringify(result)}::jsonb,finished_at=now(),leased_until=NULL,updated_at=now() WHERE id=${job.id} AND worker_id=${WORKER_ID}`;
  const[c]=await sql`SELECT count(*) FILTER(WHERE status IN('queued','retry_wait','leased','running'))::int pending FROM batch_jobs WHERE run_id=${job.run_id}`;
  if(Number(c?.pending||0)===0)await sql`UPDATE batch_runs SET status='completed',finished_at=now(),updated_at=now() WHERE id=${job.run_id} AND status IN('queued','running')`;
}
async function fail(job,error){const text=msg(error),retry=Number(job.attempt||1)<3;await sql`UPDATE batch_jobs SET status=${retry?'retry_wait':'failed'},error_class=${error?.name||'Error'},error_message=${text},available_at=CASE WHEN ${retry} THEN now()+((30*power(2,GREATEST(0,${Number(job.attempt||1)}-1)))||' seconds')::interval ELSE available_at END,leased_until=NULL,worker_id=NULL,finished_at=CASE WHEN ${retry} THEN NULL ELSE now() END,updated_at=now() WHERE id=${job.id}`;}

async function loop(){console.log(`[batch-fast] worker=${WORKER_ID} started; stages=PIKOSCORE_PENDING; concurrency=1`);while(!stopping){try{const job=await leaseOne();if(!job){await sleep(POLL_MS);continue}if(!ALLOWED_STAGES.has(job.stage)){await fail(job,new Error('Etapa no permitida por FAST worker'));continue}try{const result=await executePikoScore(job);await finish(job,{score:result.score,confidence:result.confidence,worker:WORKER_ID});console.log(`[batch-fast] done job=${job.id} ${job.entity_id} score=${result.score}`)}catch(e){await fail(job,e);console.error(`[batch-fast] failed job=${job.id} ${job.entity_id}: ${msg(e)}`)}}catch(e){console.error(`[batch-fast] loop: ${msg(e)}`);await sleep(POLL_MS)}}console.log('[batch-fast] stopped')}
for(const s of ['SIGTERM','SIGINT'])process.on(s,()=>{stopping=true});
await loop();
