import crypto from 'node:crypto';
import {classifyFunctionalOutcome,retryDefaultForOutcome} from '../lib/lifecycle-processes.mjs';

const clean=v=>v===undefined?null:v;
const errText=e=>String(e?.message||e||'Error desconocido').slice(0,1000);

export async function lifecycleContext(sql,entityId){
  const[r]=await sql`SELECT cl.lifecycle_state,cl.blocking_reason,m.imdb_id,m.type,m.tmdb_id,m.fa_id,m.title_es,m.original_title,m.year,m.runtime,m.country,m.imdb_rating,m.imdb_votes,m.fa_rating,m.fa_votes,m.tmdb_rating,m.tmdb_votes,m.poster_path,m.ratings_refreshed_at,m.pikoscore_calculated_at,m.pikoscore_version,iv.validation_status,pcs.rating_key,p.fingerprint,EXISTS(SELECT 1 FROM movie_genres g WHERE g.imdb_id=m.imdb_id) has_genres,mm.overview,EXISTS(SELECT 1 FROM series_reference sr WHERE sr.imdb_id=m.imdb_id) has_series_reference FROM movies m JOIN catalog_lifecycle cl USING(imdb_id) LEFT JOIN identity_validation iv USING(imdb_id) LEFT JOIN movie_metadata mm USING(imdb_id) LEFT JOIN plex_catalog_status pcs USING(imdb_id) LEFT JOIN plex_items p ON p.rating_key=pcs.rating_key AND p.active WHERE m.imdb_id=${entityId}`;
  return r||null;
}

export function makeContextSignature(context){
  if(!context)return null;
  const stable={state:context.lifecycle_state||null,blocking:context.blocking_reason||null,type:context.type||null,tmdb_id:context.tmdb_id||null,fa_id:context.fa_id||null,validation_status:context.validation_status||null,title_es:context.title_es||null,original_title:context.original_title||null,year:clean(context.year),runtime:clean(context.runtime),country:context.country||null,imdb_rating:clean(context.imdb_rating),imdb_votes:clean(context.imdb_votes),fa_rating:clean(context.fa_rating),fa_votes:clean(context.fa_votes),tmdb_rating:clean(context.tmdb_rating),tmdb_votes:clean(context.tmdb_votes),poster:context.poster_path||null,overview:Boolean(context.overview),genres:Boolean(context.has_genres),ratings_refreshed_at:context.ratings_refreshed_at||null,pikoscore_calculated_at:context.pikoscore_calculated_at||null,pikoscore_version:context.pikoscore_version||null,rating_key:context.rating_key||null,fingerprint:context.fingerprint||null,has_series_reference:Boolean(context.has_series_reference)};
  return crypto.createHash('sha256').update(JSON.stringify(stable)).digest('hex');
}

export async function lifecycleAttemptDecision(sql,job,retryMode='new_only'){
  const[before,psRows]=await Promise.all([
    lifecycleContext(sql,job.entity_id),
    sql`SELECT attempt_count,no_progress_count,last_outcome,next_retry_at,context_signature,manual_review FROM batch_process_state WHERE entity_type=${job.entity_type||'title'} AND entity_id=${job.entity_id} AND stage=${job.stage}`
  ]);
  const ps=psRows?.[0];
  if(!before)return{eligible:false,reason:'Título no encontrado',before:null,signature:null};
  if(String(before.lifecycle_state)!==String(job.stage))return{eligible:false,reason:`Lifecycle cambió a ${before.lifecycle_state}`,before,signature:makeContextSignature(before),stale:true};
  const signature=makeContextSignature(before);
  if(!ps)return{eligible:true,reason:'Nunca intentado',before,signature};
  const contextChanged=Boolean(ps.context_signature&&ps.context_signature!==signature);
  const technicalDue=ps.last_outcome==='ERROR'&&(!ps.next_retry_at||new Date(ps.next_retry_at)<=new Date());
  if(retryMode==='all')return{eligible:true,reason:'Forzado: todos',before,signature,contextChanged};
  if(retryMode==='new_only')return{eligible:false,reason:`Solo nuevos: ya existe un intento (${ps.last_outcome||'sin resultado'})`,before,signature,contextChanged};
  if(ps.manual_review&&!contextChanged)return{eligible:false,reason:'En revisión manual sin cambio de contexto',before,signature,contextChanged};
  if(retryMode==='new_and_technical'){
    if(technicalDue)return{eligible:true,reason:'Reintento técnico vencido',before,signature,contextChanged};
    return{eligible:false,reason:`Nuevos + errores técnicos: ya intentado (${ps.last_outcome||'sin resultado'})`,before,signature,contextChanged};
  }
  if(retryMode==='include_unresolved'){
    if(ps.last_outcome==='ERROR'&&!technicalDue)return{eligible:false,reason:'Error técnico todavía en cooldown',before,signature,contextChanged};
    if(ps.manual_review&&!contextChanged)return{eligible:false,reason:'En revisión manual sin cambio de contexto',before,signature,contextChanged};
    return{eligible:true,reason:contextChanged?'Contexto cambiado':'Reintento no resuelto solicitado explícitamente',before,signature,contextChanged};
  }
  return{eligible:false,reason:`Ya intentado (${ps.last_outcome||'sin resultado'}) con el mismo contexto`,before,signature,contextChanged};
}

export async function beginLifecycleJob(sql,job,{retryMode='new_only'}={}){
  const decision=await lifecycleAttemptDecision(sql,job,retryMode);
  if(!decision.eligible)return decision;
  const{before,signature}=decision;
  await Promise.all([
    sql`UPDATE batch_jobs SET lifecycle_before=${before.lifecycle_state},context_signature=${signature},updated_at=now() WHERE id=${job.id}`,
    sql`INSERT INTO batch_process_state(entity_type,entity_id,stage,attempt_count,last_attempt_at,context_signature,last_job_id,updated_at) VALUES(${job.entity_type||'title'},${job.entity_id},${job.stage},1,now(),${signature},${job.id},now()) ON CONFLICT(entity_type,entity_id,stage) DO UPDATE SET attempt_count=batch_process_state.attempt_count+1,last_attempt_at=now(),context_signature=EXCLUDED.context_signature,last_job_id=EXCLUDED.last_job_id,updated_at=now()`
  ]);
  return{eligible:true,before,signature,reason:decision.reason,contextChanged:decision.contextChanged};
}

export async function runLifecycleStep(sql,job,{key,source,order=0},fn){
  const started=Date.now();
  await sql`INSERT INTO batch_job_steps(job_id,step_key,step_order,source,status,attempted,started_at,created_at,updated_at) VALUES(${job.id},${key},${order},${source},'running',true,now(),now(),now()) ON CONFLICT(job_id,step_key) DO UPDATE SET step_order=EXCLUDED.step_order,source=EXCLUDED.source,status='running',attempted=true,started_at=now(),finished_at=NULL,error_class=NULL,error_message=NULL,updated_at=now()`;
  try{
    const value=await fn();
    const found=value?.found===undefined?true:Boolean(value.found),changed=Boolean(value?.changed),before=value?.before||{},after=value?.after||{},reason=value?.reason||null,result=value?.result??value??{};
    await sql`UPDATE batch_job_steps SET status='done',found=${found},changed=${changed},before_value=${JSON.stringify(before)}::jsonb,after_value=${JSON.stringify(after)}::jsonb,result=${JSON.stringify(result)}::jsonb,reason=${reason},finished_at=now(),duration_ms=${Date.now()-started},updated_at=now() WHERE job_id=${job.id} AND step_key=${key}`;
    return{ok:true,key,source,found,changed,before,after,reason,result};
  }catch(e){
    const klass=e?.permanent?'permanent':e?.status?'source':'technical';
    await sql`UPDATE batch_job_steps SET status='failed',found=false,changed=false,error_class=${klass},error_message=${errText(e)},finished_at=now(),duration_ms=${Date.now()-started},updated_at=now() WHERE job_id=${job.id} AND step_key=${key}`;
    return{ok:false,key,source,found:false,changed:false,error:e,error_class:klass,error_message:errText(e)};
  }
}

export async function skipLifecycleStep(sql,job,{key,source,order=0},reason){
  await sql`INSERT INTO batch_job_steps(job_id,step_key,step_order,source,status,attempted,found,changed,reason,created_at,updated_at,finished_at,duration_ms) VALUES(${job.id},${key},${order},${source},'skipped',false,NULL,false,${reason||'No necesario'},now(),now(),now(),0) ON CONFLICT(job_id,step_key) DO UPDATE SET step_order=EXCLUDED.step_order,source=EXCLUDED.source,status='skipped',attempted=false,found=NULL,changed=false,reason=EXCLUDED.reason,finished_at=now(),duration_ms=0,updated_at=now()`;
  return{ok:true,key,source,skipped:true,changed:false,reason};
}

export async function finishLifecycleJob(sql,job,{before,steps=[],forceReview=false,reviewReason=null,complete=true,found=true,extra={}}={}){
  const after=await lifecycleContext(sql,job.entity_id);
  const changed=steps.some(s=>s?.changed),errors=steps.filter(s=>s&&!s.ok&&!s.skipped),notFound=steps.some(s=>s?.found===false&&!s?.error);
  const review=forceReview||['IDENTITY_REVIEW_REQUIRED','MOVIE_FILE_REVIEW','SERIES_REVIEW'].includes(String(after?.lifecycle_state||''));
  const outcome=classifyFunctionalOutcome({beforeState:before?.lifecycle_state,afterState:after?.lifecycle_state,changed,found:notFound?false:found,complete:complete&&errors.length===0,review,error:errors.length>0&&after?.lifecycle_state===before?.lifecycle_state});
  const summary={process_stage:job.stage,functional_outcome:outcome,lifecycle_before:before?.lifecycle_state||null,lifecycle_after:after?.lifecycle_state||null,changed,steps:steps.map(s=>({key:s.key,source:s.source,ok:s.ok,skipped:Boolean(s.skipped),found:s.found,changed:Boolean(s.changed),reason:s.reason||null,error:s.error_message||null})),review_reason:reviewReason||null,...extra};
  const noProgress=outcome==='CORREGIDO'?0:1,manual=outcome==='REVISION_MANUAL';
  await Promise.all([
    sql`UPDATE batch_jobs SET functional_outcome=${outcome},lifecycle_after=${after?.lifecycle_state||null},manual_review_reason=${reviewReason||null},result_summary=COALESCE(result_summary,'{}'::jsonb)||${JSON.stringify(summary)}::jsonb,updated_at=now() WHERE id=${job.id}`,
    sql`UPDATE batch_process_state SET last_outcome=${outcome},no_progress_count=CASE WHEN ${outcome}='CORREGIDO' THEN 0 ELSE no_progress_count+${noProgress} END,manual_review=${manual},manual_review_reason=${reviewReason||null},next_retry_at=CASE WHEN ${outcome}='ERROR' THEN now()+interval '1 hour' ELSE NULL END,last_result=${JSON.stringify(summary)}::jsonb,updated_at=now() WHERE entity_type=${job.entity_type||'title'} AND entity_id=${job.entity_id} AND stage=${job.stage}`
  ]);
  return{outcome,after,summary,retryPolicy:retryDefaultForOutcome(outcome)};
}

export async function markLifecycleJobSkipped(sql,job,decision){
  await sql`WITH done AS (UPDATE batch_jobs SET status='skipped',functional_outcome='SIN_CAMBIOS',lifecycle_before=${decision?.before?.lifecycle_state||null},lifecycle_after=${decision?.before?.lifecycle_state||null},context_signature=${decision?.signature||null},result_summary=COALESCE(result_summary,'{}'::jsonb)||${JSON.stringify({process_stage:job.stage,functional_outcome:'SIN_CAMBIOS',skipped_by_retry_policy:true,reason:decision?.reason||'No elegible'})}::jsonb,finished_at=now(),leased_until=NULL,updated_at=now() WHERE id=${job.id} RETURNING run_id) UPDATE batch_runs r SET status=CASE WHEN EXISTS(SELECT 1 FROM batch_jobs f WHERE f.run_id=r.id AND f.status='failed') THEN 'failed' ELSE 'completed' END,finished_at=now(),updated_at=now() WHERE r.id=(SELECT run_id FROM done) AND r.status IN('queued','running') AND NOT EXISTS(SELECT 1 FROM batch_jobs p WHERE p.run_id=r.id AND p.status IN('queued','retry_wait','leased','running'))`;
}

export async function markLifecycleJobError(sql,job,{before,error}={}){
  const message=errText(error),signature=before?makeContextSignature(before):null;
  await Promise.all([
    sql`UPDATE batch_jobs SET functional_outcome='ERROR',lifecycle_before=COALESCE(lifecycle_before,${before?.lifecycle_state||null}),context_signature=COALESCE(context_signature,${signature}),result_summary=COALESCE(result_summary,'{}'::jsonb)||${JSON.stringify({process_stage:job.stage,functional_outcome:'ERROR',error:message})}::jsonb,updated_at=now() WHERE id=${job.id}`,
    sql`INSERT INTO batch_process_state(entity_type,entity_id,stage,attempt_count,no_progress_count,last_attempt_at,last_outcome,next_retry_at,context_signature,manual_review,last_job_id,last_result,updated_at) VALUES(${job.entity_type||'title'},${job.entity_id},${job.stage},1,1,now(),'ERROR',now()+interval '1 hour',${signature},false,${job.id},${JSON.stringify({error:message})}::jsonb,now()) ON CONFLICT(entity_type,entity_id,stage) DO UPDATE SET last_outcome='ERROR',next_retry_at=now()+interval '1 hour',last_job_id=EXCLUDED.last_job_id,last_result=EXCLUDED.last_result,updated_at=now()`
  ]);
}
