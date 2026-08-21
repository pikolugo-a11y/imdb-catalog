import {neon} from '@neondatabase/serverless';
import {calcIdentity} from './identity-validation-algorithm.mjs';

const dbUrl=process.env.DATABASE_URL;
const runId=Number(process.env.PIPELINE_RUN_ID||0);
const githubToken=process.env.GITHUB_TOKEN;
const githubRepository=process.env.GITHUB_REPOSITORY||'pikolugo-a11y/imdb-catalog';
if(!dbUrl)throw new Error('Falta DATABASE_URL');
if(!runId)throw new Error('Falta PIPELINE_RUN_ID');

const sql=neon(dbUrl);
const started=Date.now();
const SESSION_LIMIT=2000;
const WRITE_BATCH=25;

async function audit(action,payload={}){
 try{await sql`INSERT INTO admin_events(event_type,entity_type,entity_id,action,payload,created_at) VALUES('identity_validation','identity_validation',${String(runId)},${action},${JSON.stringify(payload)}::jsonb,now())`}catch{}
}
async function state(){const[r]=await sql`SELECT status,summary FROM pipeline_runs WHERE id=${runId}`;return r||null}
async function cancelled(){const r=await state();return !r||r.status!=='running'||Boolean(r.summary?.cancel_requested)}
async function setSummary(patch){await sql`UPDATE pipeline_runs SET summary=COALESCE(summary,'{}'::jsonb)||${JSON.stringify(patch)}::jsonb,updated_at=now() WHERE id=${runId} AND status='running'`}
async function eligibleCount(){const[r]=await sql`SELECT count(*)::int total FROM identity_validation v JOIN movies m USING(imdb_id) LEFT JOIN catalog_exclusions ex USING(imdb_id) WHERE ex.imdb_id IS NULL AND v.tmdb_id=m.tmdb_id AND v.fa_id=m.fa_id AND v.imdb_original_title IS NOT NULL AND v.imdb_year IS NOT NULL AND v.tmdb_original_title IS NOT NULL AND v.tmdb_year IS NOT NULL AND v.fa_original_title IS NOT NULL AND v.fa_year IS NOT NULL`;return Number(r?.total||0)}
async function pendingCount(){const[r]=await sql`SELECT count(*)::int total FROM identity_validation v JOIN movies m USING(imdb_id) LEFT JOIN catalog_exclusions ex USING(imdb_id) WHERE ex.imdb_id IS NULL AND v.validation_status='revalidation_pending' AND v.tmdb_id=m.tmdb_id AND v.fa_id=m.fa_id AND v.imdb_original_title IS NOT NULL AND v.imdb_year IS NOT NULL AND v.tmdb_original_title IS NOT NULL AND v.tmdb_year IS NOT NULL AND v.fa_original_title IS NOT NULL AND v.fa_year IS NOT NULL`;return Number(r?.total||0)}
async function statusCounts(){const[r]=await sql`SELECT count(*) FILTER(WHERE validation_status='valid')::int valid,count(*) FILTER(WHERE validation_status='doubtful')::int doubtful,count(*) FILTER(WHERE validation_status='invalid')::int invalid,count(*) FILTER(WHERE validation_status='insufficient')::int insufficient FROM identity_validation`;return r||{valid:0,doubtful:0,invalid:0,insufficient:0}}
async function finish(status,summary,processed=0,errors=0){await sql`UPDATE pipeline_runs SET status=${status},processed_count=${processed},updated_count=${processed},error_count=${errors},summary=COALESCE(summary,'{}'::jsonb)||${JSON.stringify(summary)}::jsonb,finished_at=now(),updated_at=now() WHERE id=${runId}`}
async function dispatchContinuation(){if(!githubToken)throw new Error('No hay GITHUB_TOKEN para continuar el recálculo');const url=`https://api.github.com/repos/${githubRepository}/actions/workflows/identity-validation-recalculate.yml/dispatches`;const r=await fetch(url,{method:'POST',headers:{Authorization:`Bearer ${githubToken}`,Accept:'application/vnd.github+json','X-GitHub-Api-Version':'2022-11-28','User-Agent':'PikoFilm/3.0'},body:JSON.stringify({ref:'main',inputs:{run_id:String(runId)}})});if(!r.ok)throw new Error(`No se pudo encadenar el siguiente bloque de recálculo: HTTP ${r.status} ${(await r.text()).slice(0,200)}`)}

async function main(){
 const total=await eligibleCount();
 const initialPending=await pendingCount();
 await setSummary({stage:'recalculating_cache',current_block:'Recalculando solo evidencias cacheadas',mode:'cache_only',total,cache_pending:initialPending,cache_processed:0,external_sources:false});
 await audit('cached_recalculation_session_started',{total,pending:initialPending,session_limit:SESSION_LIMIT,external_sources:false});
 if(await cancelled()){
  const counts=await statusCounts();const summary={stage:'cancelled',current_block:'Recálculo detenido por el usuario',mode:'cache_only',external_sources:false,...counts};await finish('failed',summary,0);return;
 }
 const rows=await sql`SELECT v.* FROM identity_validation v JOIN movies m USING(imdb_id) LEFT JOIN catalog_exclusions ex USING(imdb_id) WHERE ex.imdb_id IS NULL AND v.validation_status='revalidation_pending' AND v.tmdb_id=m.tmdb_id AND v.fa_id=m.fa_id AND v.imdb_original_title IS NOT NULL AND v.imdb_year IS NOT NULL AND v.tmdb_original_title IS NOT NULL AND v.tmdb_year IS NOT NULL AND v.fa_original_title IS NOT NULL AND v.fa_year IS NOT NULL ORDER BY v.imdb_id LIMIT ${SESSION_LIMIT}`;
 let processed=0;
 for(let i=0;i<rows.length;i+=WRITE_BATCH){
  if(await cancelled())break;
  const batch=rows.slice(i,i+WRITE_BATCH);
  await Promise.all(batch.map(async v=>{
   const r=calcIdentity(v);
   const manual=v.validation_details?.manual;
   const details={...r.details,...(manual?{manual}:{})};
   await sql`UPDATE identity_validation SET validation_status=${r.status},validation_score=${r.score},validation_details=${JSON.stringify(details)}::jsonb,suspected_source=${r.suspected},validated_at=now(),updated_at=now() WHERE imdb_id=${v.imdb_id}`;
  }));
  processed+=batch.length;
  const remaining=Math.max(0,initialPending-processed);
  await setSummary({stage:'recalculating_cache',current_block:`Recalculando caché · ${processed.toLocaleString('es-ES')} procesadas`,mode:'cache_only',cache_pending:remaining,cache_processed:processed,external_sources:false,progress_pct:initialPending?Math.round(processed/initialPending*1000)/10:100});
 }
 if(await cancelled()){
  const counts=await statusCounts();const remaining=await pendingCount();const summary={stage:'cancelled',current_block:'Recálculo detenido por el usuario',mode:'cache_only',external_sources:false,cache_processed:processed,cache_pending:remaining,...counts,elapsed_seconds:Math.round((Date.now()-started)/1000)};await finish('failed',summary,processed);await audit('cached_recalculation_cancelled',summary);return;
 }
 const remaining=await pendingCount();
 const counts=await statusCounts();
 if(remaining===0){const summary={stage:'done',current_block:'Recálculo de caché completado',mode:'cache_only',external_sources:false,total,cache_processed:processed,cache_pending:0,progress_pct:100,...counts,elapsed_seconds:Math.round((Date.now()-started)/1000)};await finish('success',summary,processed);await audit('cached_recalculation_completed',summary);console.log(JSON.stringify(summary,null,2));return}
 const summary={stage:'handoff',current_block:'Continuando recálculo en el siguiente bloque',mode:'cache_only',external_sources:false,total,cache_processed:processed,cache_pending:remaining,...counts,elapsed_seconds:Math.round((Date.now()-started)/1000)};
 await setSummary(summary);await audit('cached_recalculation_handoff',summary);await dispatchContinuation();console.log(JSON.stringify(summary,null,2));
}
main().catch(async e=>{const msg=e?.message||String(e);try{const counts=await statusCounts();const summary={stage:'failed',current_block:'Error en recálculo de caché',mode:'cache_only',external_sources:false,error:{message:msg},...counts};await finish('failed',summary,0,1);await audit('cached_recalculation_failed',{error:msg})}catch{}console.error(e);process.exit(1)});
