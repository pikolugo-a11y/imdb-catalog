import {neon} from '@neondatabase/serverless';
import zlib from 'node:zlib';
import readline from 'node:readline';
import {Readable} from 'node:stream';
import {spawnSync} from 'node:child_process';

const dbUrl=process.env.DATABASE_URL;
const runId=Number(process.env.PIPELINE_RUN_ID||0);
const tmdbToken=process.env.TMDB_API_TOKEN;
const githubToken=process.env.GITHUB_TOKEN;
const githubRepository=process.env.GITHUB_REPOSITORY||'pikolugo-a11y/imdb-catalog';
if(!dbUrl)throw new Error('Falta DATABASE_URL');
if(!runId)throw new Error('Falta PIPELINE_RUN_ID');
if(!tmdbToken)throw new Error('Falta TMDB_API_TOKEN');

const sql=neon(dbUrl);
const started=Date.now();
const IMDB_LIMIT=5000;
const TMDB_LIMIT=1000;
const TMDB_CONCURRENCY=8;
const FA_LIMIT=100;
const FA_MICROBLOCK=10;
const SESSION_BUDGET_MS=12*60*1000;

async function audit(action,payload={}){try{await sql`INSERT INTO admin_events(event_type,entity_type,entity_id,action,payload,created_at) VALUES('identity_validation','identity_validation',${String(runId)},${action},${JSON.stringify(payload)}::jsonb,now())`}catch{}}
async function state(){const[r]=await sql`SELECT status,summary FROM pipeline_runs WHERE id=${runId}`;return r||null}
async function cancelled(){const r=await state();return !r||r.status!=='running'||Boolean(r.summary?.cancel_requested)}
async function setSummary(patch){await sql`UPDATE pipeline_runs SET summary=COALESCE(summary,'{}'::jsonb)||${JSON.stringify(patch)}::jsonb,updated_at=now() WHERE id=${runId} AND status='running'`}
async function finish(status,summary,errors=0){const processed=Number(summary.valid??0)+Number(summary.doubtful??0)+Number(summary.invalid??0)+Number(summary.insufficient??0);await sql`UPDATE pipeline_runs SET status=${status},processed_count=${processed},updated_count=${processed},error_count=${errors},summary=COALESCE(summary,'{}'::jsonb)||${JSON.stringify(summary)}::jsonb,finished_at=now(),updated_at=now() WHERE id=${runId}`}
async function counts(){const[r]=await sql`SELECT count(*)::int total,
 count(*) FILTER(WHERE v.imdb_original_title IS NOT NULL AND v.imdb_year IS NOT NULL)::int imdb_cached,
 count(*) FILTER(WHERE v.tmdb_id=m.tmdb_id AND v.tmdb_original_title IS NOT NULL AND v.tmdb_year IS NOT NULL)::int tmdb_cached,
 count(*) FILTER(WHERE v.fa_id=m.fa_id AND v.fa_original_title IS NOT NULL AND v.fa_year IS NOT NULL)::int fa_cached,
 count(*) FILTER(WHERE v.validation_status='valid')::int valid,
 count(*) FILTER(WHERE v.validation_status='doubtful')::int doubtful,
 count(*) FILTER(WHERE v.validation_status='invalid')::int invalid,
 count(*) FILTER(WHERE v.validation_status='insufficient')::int insufficient
 FROM movies m LEFT JOIN catalog_exclusions ex USING(imdb_id) LEFT JOIN identity_validation v USING(imdb_id)
 WHERE ex.imdb_id IS NULL AND m.imdb_id~'^tt[0-9]+$' AND m.tmdb_id IS NOT NULL AND m.fa_id IS NOT NULL`;return r}
async function targets(limit,kind){const cond=kind==='imdb'?sql`(v.imdb_original_title IS NULL OR v.imdb_year IS NULL)`:kind==='tmdb'?sql`(v.tmdb_id IS DISTINCT FROM m.tmdb_id OR v.tmdb_original_title IS NULL OR v.tmdb_year IS NULL)`:sql`(v.fa_id IS DISTINCT FROM m.fa_id OR v.fa_original_title IS NULL OR v.fa_year IS NULL)`;return sql`SELECT m.imdb_id,m.type,m.tmdb_id,m.fa_id,COALESCE(m.title_es,m.title,m.original_title) title FROM movies m LEFT JOIN catalog_exclusions ex USING(imdb_id) LEFT JOIN identity_validation v USING(imdb_id) WHERE ex.imdb_id IS NULL AND m.imdb_id~'^tt[0-9]+$' AND m.tmdb_id IS NOT NULL AND m.fa_id IS NOT NULL AND ${cond} ORDER BY m.imdb_id LIMIT ${limit}`}
function progressPct(c){return c.total?Math.round(((Number(c.imdb_cached)+Number(c.tmdb_cached)+Number(c.fa_cached))/(Number(c.total)*3))*1000)/10:100}
function complete(c){return Number(c.imdb_cached)>=Number(c.total)&&Number(c.tmdb_cached)>=Number(c.total)&&Number(c.fa_cached)>=Number(c.total)}
function budgetReached(){return Date.now()-started>=SESSION_BUDGET_MS}

async function imdbBasics(ids){const wanted=new Set(ids),out=new Map(),r=await fetch('https://datasets.imdbws.com/title.basics.tsv.gz');if(!r.ok)throw new Error(`IMDb basics HTTP ${r.status}`);const rl=readline.createInterface({input:Readable.fromWeb(r.body).pipe(zlib.createGunzip()),crlfDelay:Infinity});let first=true;for await(const line of rl){if(first){first=false;continue}const p=line.split('\t'),id=p[0];if(!wanted.has(id))continue;out.set(id,{title:p[2]==='\\N'?null:p[2],original:p[3]==='\\N'?null:p[3],year:p[5]==='\\N'?null:Number(p[5])});if(out.size===wanted.size){rl.close();break}}return out}
async function saveImdb(r,x){await sql`INSERT INTO identity_validation(imdb_id,imdb_title,imdb_original_title,imdb_year,imdb_extracted_at,validation_status,created_at,updated_at) VALUES(${r.imdb_id},${x.title},${x.original},${x.year},now(),'pending_data',now(),now()) ON CONFLICT(imdb_id) DO UPDATE SET imdb_title=EXCLUDED.imdb_title,imdb_original_title=EXCLUDED.imdb_original_title,imdb_year=EXCLUDED.imdb_year,imdb_extracted_at=now(),updated_at=now()`}
async function phaseImdb(){const rows=await targets(IMDB_LIMIT,'imdb');await setSummary({current_block:'IMDb · datasets',imdb:{pending:rows.length,processed:0,limit:IMDB_LIMIT}});if(!rows.length)return 0;const map=await imdbBasics(rows.map(x=>x.imdb_id));let n=0;for(let i=0;i<rows.length;i+=25){if(await cancelled())break;const batch=rows.slice(i,i+25);await Promise.all(batch.map(async r=>{const x=map.get(r.imdb_id);if(!x)return;await saveImdb(r,x);n++}));if(n%100<25)await setSummary({imdb:{pending:rows.length,processed:n,limit:IMDB_LIMIT}})}await setSummary({imdb:{pending:rows.length,processed:n,limit:IMDB_LIMIT}});return n}

async function tmdbOne(r){const media=r.type==='Serie'||r.type==='Miniserie'?'tv':'movie',res=await fetch(`https://api.themoviedb.org/3/${media}/${r.tmdb_id}?language=es-ES`,{headers:{Authorization:`Bearer ${tmdbToken}`,Accept:'application/json'}});if(!res.ok)throw new Error(`TMDb ${res.status}`);const d=await res.json(),date=d.release_date||d.first_air_date||'';return{title:d.title||d.name||null,original:d.original_title||d.original_name||null,year:Number(date.slice(0,4))||null}}
async function saveTmdb(r,x){await sql`INSERT INTO identity_validation(imdb_id,tmdb_id,tmdb_title_es,tmdb_original_title,tmdb_year,tmdb_extracted_at,validation_status,created_at,updated_at) VALUES(${r.imdb_id},${String(r.tmdb_id)},${x.title},${x.original},${x.year},now(),'pending_data',now(),now()) ON CONFLICT(imdb_id) DO UPDATE SET tmdb_id=EXCLUDED.tmdb_id,tmdb_title_es=EXCLUDED.tmdb_title_es,tmdb_original_title=EXCLUDED.tmdb_original_title,tmdb_year=EXCLUDED.tmdb_year,tmdb_extracted_at=now(),validation_status='pending_data',updated_at=now()`}
async function phaseTmdb(){const rows=await targets(TMDB_LIMIT,'tmdb');await setSummary({current_block:'TMDb · API',tmdb:{pending:rows.length,processed:0,errors:0,limit:TMDB_LIMIT,concurrency:TMDB_CONCURRENCY}});let n=0,e=0;for(let i=0;i<rows.length;i+=TMDB_CONCURRENCY){if(await cancelled())break;const batch=rows.slice(i,i+TMDB_CONCURRENCY);await Promise.all(batch.map(async r=>{try{const x=await tmdbOne(r);await saveTmdb(r,x);n++}catch(err){e++;await audit('tmdb_evidence_failed',{imdb_id:r.imdb_id,error:String(err?.message||err)})}}));if((n+e)%40<TMDB_CONCURRENCY)await setSummary({tmdb:{pending:rows.length,processed:n,errors:e,limit:TMDB_LIMIT,concurrency:TMDB_CONCURRENCY}})}await setSummary({tmdb:{pending:rows.length,processed:n,errors:e,limit:TMDB_LIMIT,concurrency:TMDB_CONCURRENCY}});return{n,e}}

async function saveFa(r,x){await sql`INSERT INTO identity_validation(imdb_id,fa_id,fa_title_es,fa_original_title,fa_year,fa_extracted_at,validation_status,created_at,updated_at) VALUES(${r.imdb_id},${String(r.fa_id)},${x.title||null},${x.original_title||null},${x.year||null},now(),'pending_data',now(),now()) ON CONFLICT(imdb_id) DO UPDATE SET fa_id=EXCLUDED.fa_id,fa_title_es=EXCLUDED.fa_title_es,fa_original_title=EXCLUDED.fa_original_title,fa_year=EXCLUDED.fa_year,fa_extracted_at=now(),validation_status='pending_data',updated_at=now()`}
async function phaseFa(){const rows=await targets(FA_LIMIT,'fa');await setSummary({current_block:'FilmAffinity · microbloques seguros',fa:{pending:rows.length,processed:0,errors:0,limit:FA_LIMIT,microblock:FA_MICROBLOCK,delay_ms:1250}});if(!rows.length)return{n:0,e:0,breaker:false};let n=0,e=0,breaker=false;for(let i=0;i<rows.length;i+=FA_MICROBLOCK){if(await cancelled())break;const block=rows.slice(i,i+FA_MICROBLOCK);const p=spawnSync('python',['worker/fa-evidence.py'],{input:JSON.stringify(block.map(r=>({fa_id:String(r.fa_id)}))),encoding:'utf8',timeout:120000});if(p.error)throw p.error;if(p.status!==0)throw new Error((p.stderr||'FilmAffinity helper falló').slice(-500));let out=[];try{out=JSON.parse((p.stdout||'[]').trim())}catch{throw new Error('Respuesta inválida del helper FilmAffinity')}for(const x of out){if(x.circuit_breaker){breaker=true;break}const r=block.find(y=>String(y.fa_id)===String(x.fa_id));if(!r)continue;if(x.ok){await saveFa(r,x);n++}else{e++;await audit('fa_evidence_failed',{imdb_id:r.imdb_id,fa_id:r.fa_id,error:x.error})}}await setSummary({fa:{pending:rows.length,processed:n,errors:e,limit:FA_LIMIT,microblock:FA_MICROBLOCK,delay_ms:1250,circuit_breaker:breaker}});if(breaker)break}return{n,e,breaker}}

function norm(s){return String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').replace(/\b(the|a|an|el|la|los|las|un|una|unos|unas)\b/g,' ').replace(/\s+/g,' ').trim()}
function sim(a,b){a=norm(a);b=norm(b);if(!a||!b)return 0;const m=Array.from({length:b.length+1},(_,i)=>i);for(let i=1;i<=a.length;i++){let prev=m[0];m[0]=i;for(let j=1;j<=b.length;j++){const old=m[j];m[j]=Math.min(m[j]+1,m[j-1]+1,prev+(a[i-1]===b[j-1]?0:1));prev=old}}return Math.round((1-m[b.length]/Math.max(a.length,b.length))*100)}
function calc(v){const it=sim(v.imdb_original_title,v.tmdb_original_title),ifv=sim(v.imdb_original_title,v.fa_original_title),tf=sim(v.tmdb_original_title,v.fa_original_title),years=[v.imdb_year,v.tmdb_year,v.fa_year].map(Number);if([v.imdb_original_title,v.tmdb_original_title,v.fa_original_title].some(x=>!x)||years.some(x=>!x))return{status:'insufficient',score:null,suspected:null,details:{explanation:'Falta título original o año en alguna fuente'}};const y=(a,b)=>{const d=Math.abs(a-b);return d===0?20:d===1?10:-20},score=Math.max(0,Math.min(100,Math.round((it+ifv+tf)/5)+Math.max(-40,Math.min(40,y(years[0],years[1])+y(years[0],years[2])+y(years[1],years[2])))));const av={imdb:(it+ifv)/2,tmdb:(it+tf)/2,fa:(ifv+tf)/2},rank=Object.entries(av).sort((a,b)=>a[1]-b[1]);let suspected=rank[1][1]-rank[0][1]>=18?rank[0][0]:null;let status=score>=85?'valid':score>=60?'doubtful':'invalid';if(Math.max(...years)-Math.min(...years)>1&&status==='valid')status='doubtful';return{status,score,suspected,details:{explanation:status==='valid'?'Título original y año coinciden con alta confianza':suspected?`La fuente ${suspected.toUpperCase()} se desvía de las otras dos`:'Hay diferencias relevantes entre títulos originales o años',similarity:{imdb_tmdb:it,imdb_fa:ifv,tmdb_fa:tf}}}}
async function validateReady(){const rows=await sql`SELECT * FROM identity_validation WHERE imdb_original_title IS NOT NULL AND imdb_year IS NOT NULL AND tmdb_original_title IS NOT NULL AND tmdb_year IS NOT NULL AND fa_original_title IS NOT NULL AND fa_year IS NOT NULL AND validation_status IN('pending_data','revalidation_pending','insufficient') LIMIT 2000`;let n=0;for(let i=0;i<rows.length;i+=25){if(await cancelled())break;const batch=rows.slice(i,i+25);await Promise.all(batch.map(async v=>{const r=calc(v);await sql`UPDATE identity_validation SET validation_status=${r.status},validation_score=${r.score},validation_details=${JSON.stringify(r.details)}::jsonb,suspected_source=${r.suspected},validated_at=now(),updated_at=now() WHERE imdb_id=${v.imdb_id}`;n++}))}return n}

async function dispatchContinuation(){if(!githubToken)throw new Error('No hay GITHUB_TOKEN para continuar la sesión');const url=`https://api.github.com/repos/${githubRepository}/actions/workflows/identity-validation-refresh.yml/dispatches`;const r=await fetch(url,{method:'POST',headers:{Authorization:`Bearer ${githubToken}`,Accept:'application/vnd.github+json','X-GitHub-Api-Version':'2022-11-28','User-Agent':'PikoFilm/3.0'},body:JSON.stringify({ref:'main',inputs:{run_id:String(runId)}})});if(!r.ok)throw new Error(`No se pudo encadenar el siguiente bloque: HTTP ${r.status} ${(await r.text()).slice(0,200)}`)}
async function snapshot(stage,currentBlock,extra={}){const c=await counts();const summary={stage,current_block:currentBlock,progress_pct:progressPct(c),total:Number(c.total),imdb:{cached:Number(c.imdb_cached),total:Number(c.total),limit:IMDB_LIMIT},tmdb:{cached:Number(c.tmdb_cached),total:Number(c.total),limit:TMDB_LIMIT,concurrency:TMDB_CONCURRENCY},fa:{cached:Number(c.fa_cached),total:Number(c.total),limit:FA_LIMIT,microblock:FA_MICROBLOCK,delay_ms:1250},valid:Number(c.valid),doubtful:Number(c.doubtful),invalid:Number(c.invalid),insufficient:Number(c.insufficient),elapsed_seconds:Math.round((Date.now()-started)/1000),...extra};await setSummary(summary);return{c,summary}}
async function stop(){const{summary}=await snapshot('cancelled','Detenido por el usuario',{cancelled:true});await finish('failed',summary);await audit('validation_cancelled',summary)}

async function main(){const before=await counts();await setSummary({stage:'running',current_block:'Preparando',total:Number(before.total),progress_pct:progressPct(before),before});await audit('validation_session_started',{limits:{imdb:IMDB_LIMIT,tmdb:TMDB_LIMIT,fa:FA_LIMIT,fa_microblock:FA_MICROBLOCK},before});if(await cancelled())return stop();let cycles=0,totalProgress=0,totalErrors=0;
 while(!budgetReached()){
  if(await cancelled())return stop();
  const cycleBefore=await counts();if(complete(cycleBefore))break;
  cycles++;
  const imdb=await phaseImdb();if(await cancelled())return stop();
  const tmdb=await phaseTmdb();if(await cancelled())return stop();
  const fa=await phaseFa();if(await cancelled())return stop();
  const validated=await validateReady();
  totalErrors+=tmdb.e+fa.e;totalProgress+=imdb+tmdb.n+fa.n+validated;
  const{c}=await snapshot(fa.breaker?'paused_circuit_breaker':'running',fa.breaker?'FilmAffinity detenido por protección':`Bloque ${cycles} completado`,{cycle:cycles,cycle_progress:imdb+tmdb.n+fa.n+validated});
  if(fa.breaker){const{summary}=await snapshot('paused_circuit_breaker','FilmAffinity detenido por protección',{cycle:cycles});await finish('failed',summary,totalErrors);await audit('validation_paused_circuit_breaker',summary);return}
  if(complete(c))break;
  if(imdb+tmdb.n+fa.n+validated===0){const{summary}=await snapshot('blocked_no_progress','Proceso detenido: no hay avance; quedan fuentes con errores o datos no recuperables',{cycle:cycles});await finish('failed',summary,totalErrors||1);await audit('validation_blocked_no_progress',summary);return}
 }
 const after=await counts();
 if(complete(after)){
  const{summary}=await snapshot('done','Validación completada',{cycles,session_progress:totalProgress});await finish('success',summary,totalErrors);await audit('validation_session_completed',summary);console.log(JSON.stringify(summary,null,2));return
 }
 const{summary}=await snapshot('handoff','Continuando en el siguiente bloque seguro',{cycles,session_progress:totalProgress});await audit('validation_handoff',summary);try{await dispatchContinuation();console.log(JSON.stringify(summary,null,2))}catch(e){const failed={...summary,stage:'continuation_failed',current_block:'No se pudo iniciar el siguiente bloque',error:{message:e?.message||String(e)}};await finish('failed',failed,totalErrors+1);await audit('validation_continuation_failed',failed);throw e}
}

main().catch(async e=>{const msg=e?.message||String(e);try{const s=await state();if(s?.status==='running'){await finish('failed',{stage:'failed',current_block:'Error',error:{message:msg},elapsed_seconds:Math.round((Date.now()-started)/1000)},1)}await audit('validation_failed',{error:msg})}catch{}console.error(e);process.exit(1)});
