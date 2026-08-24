import 'server-only';
import {db} from './db';

export const BATCH_STAGES=[
  'IDENTITY_PENDING','IDENTITY_VALIDATION','DATA_INCOMPLETE','PIKOSCORE_PENDING',
  'MOVIE_FILE_PENDING','SERIES_SYNC_PENDING','TECH_PENDING'
];
export const RETRY_MODES=['new_only','new_and_technical','include_unresolved','all'];
const RUN_STATUSES=new Set(['queued','running','paused','completed','cancelled','failed']);
const SOURCES=new Set(['fast','tmdb','wikidata','omdb','plex','filmaffinity']);

function clampInt(v,min,max,fallback){const n=Number.parseInt(v,10);return Number.isFinite(n)?Math.max(min,Math.min(max,n)):fallback}
function stageOf(v){const s=String(v||'').trim();if(!BATCH_STAGES.includes(s))throw new Error('Etapa batch no permitida');return s}
function retryModeOf(v){const s=String(v||'new_only');return RETRY_MODES.includes(s)?s:'new_only'}

export async function getBatchControlOverview(){
  const sql=db();
  const [control,limits,runs,jobs,outcomes,manual]=await Promise.all([
    sql`SELECT paused,pause_reason,updated_at,updated_by FROM batch_runtime_control WHERE singleton=true LIMIT 1`,
    sql`SELECT source,enabled,max_concurrency,min_interval_ms,daily_budget,breaker_state,blocked_until,consecutive_errors,updated_at FROM batch_source_limits ORDER BY CASE source WHEN 'fast' THEN 0 WHEN 'tmdb' THEN 1 WHEN 'wikidata' THEN 2 WHEN 'omdb' THEN 3 WHEN 'plex' THEN 4 WHEN 'filmaffinity' THEN 5 ELSE 99 END,source`,
    sql`SELECT r.id,r.mode,r.target_stage,r.status,r.requested_by,r.limits,r.stop_reason,r.created_at,r.started_at,r.finished_at,r.updated_at,
      count(j.*)::int jobs,
      count(j.*) FILTER(WHERE j.status='queued')::int queued,
      count(j.*) FILTER(WHERE j.status IN('leased','running'))::int active,
      count(j.*) FILTER(WHERE j.status='retry_wait')::int retry_wait,
      count(j.*) FILTER(WHERE j.status='review')::int review,
      count(j.*) FILTER(WHERE j.status='done')::int done,
      count(j.*) FILTER(WHERE j.status='failed')::int failed,
      count(j.*) FILTER(WHERE j.status='cancelled')::int cancelled,
      count(j.*) FILTER(WHERE j.status='skipped')::int skipped,
      count(j.*) FILTER(WHERE j.functional_outcome='CORREGIDO')::int corrected,
      count(j.*) FILTER(WHERE j.functional_outcome='ACTUALIZADO_SIN_AVANCE')::int updated_no_advance,
      count(j.*) FILTER(WHERE j.functional_outcome='SIN_CAMBIOS')::int no_change,
      count(j.*) FILTER(WHERE j.functional_outcome='NO_ENCONTRADO')::int not_found,
      count(j.*) FILTER(WHERE j.functional_outcome='INCOMPLETO')::int incomplete,
      count(j.*) FILTER(WHERE j.functional_outcome='REVISION_MANUAL')::int manual_review,
      count(j.*) FILTER(WHERE j.functional_outcome='ERROR')::int functional_error
      FROM batch_runs r LEFT JOIN batch_jobs j ON j.run_id=r.id
      GROUP BY r.id ORDER BY r.created_at DESC LIMIT 40`,
    sql`SELECT id,run_id,entity_type,entity_id,stage,status,attempt,priority,available_at,leased_until,worker_id,error_class,error_message,functional_outcome,lifecycle_before,lifecycle_after,manual_review_reason,result_summary,created_at,updated_at
      FROM batch_jobs ORDER BY created_at DESC LIMIT 100`,
    sql`SELECT functional_outcome,count(*)::int total FROM batch_jobs WHERE functional_outcome IS NOT NULL GROUP BY functional_outcome ORDER BY total DESC`,
    sql`SELECT entity_type,entity_id,stage,attempt_count,no_progress_count,last_attempt_at,last_outcome,manual_review_reason,last_job_id,updated_at FROM batch_process_state WHERE manual_review=true ORDER BY updated_at DESC LIMIT 100`
  ]);
  const summary=(runs||[]).reduce((a,r)=>{a.runs++;a.jobs+=r.jobs||0;a.queued+=r.queued||0;a.active+=r.active||0;a.retry+=r.retry_wait||0;a.review+=r.review||0;a.failed+=r.failed||0;return a},{runs:0,jobs:0,queued:0,active:0,retry:0,review:0,failed:0});
  return{control:control[0]||{paused:true,pause_reason:'Sin configuración'},limits,runs,jobs,summary,outcomes,manualReview:manual};
}

export async function createStageRun({stage,limit=100,requestedBy='pikofilm-ui',retryMode='new_only'}={}){
  const target=stageOf(stage),maxJobs=clampInt(limit,1,5000,100),mode=retryModeOf(retryMode),sql=db();
  const limits={max_jobs:maxJobs,retry_mode:mode,orchestration:'lifecycle'};
  const [run]=await sql`INSERT INTO batch_runs(mode,target_stage,status,requested_by,limits) VALUES('stage',${target},'queued',${String(requestedBy).slice(0,80)},${JSON.stringify(limits)}::jsonb) RETURNING id`;
  try{
    const inserted=await sql`INSERT INTO batch_jobs(run_id,entity_type,entity_id,stage,status,priority,available_at,idempotency_key)
      SELECT ${run.id},'title',cl.imdb_id,${target},'queued',100,now(),${target}||':'||cl.imdb_id
      FROM catalog_lifecycle cl
      LEFT JOIN batch_process_state ps ON ps.entity_type='title' AND ps.entity_id=cl.imdb_id AND ps.stage=${target}
      WHERE cl.lifecycle_state=${target}
        AND (
          ${mode}='all'
          OR (${mode}='new_only' AND ps.entity_id IS NULL)
          OR (${mode}='new_and_technical' AND (ps.entity_id IS NULL OR (ps.last_outcome='ERROR' AND COALESCE(ps.next_retry_at,now())<=now())))
          OR (${mode}='include_unresolved' AND (ps.entity_id IS NULL OR ps.manual_review=false OR ps.context_signature IS DISTINCT FROM (
            SELECT encode(digest(concat_ws('|',cl.lifecycle_state,COALESCE(cl.blocking_reason,''),COALESCE(m.tmdb_id,''),COALESCE(m.fa_id,''),COALESCE(m.title_es,''),COALESCE(m.original_title,''),COALESCE(m.year::text,''),COALESCE(m.runtime::text,''),COALESCE(m.imdb_rating::text,''),COALESCE(m.imdb_votes::text,''),COALESCE(m.fa_rating::text,''),COALESCE(m.fa_votes::text,''),COALESCE(m.tmdb_rating::text,''),COALESCE(m.tmdb_votes::text,'')),'sha256'),'hex') FROM movies m WHERE m.imdb_id=cl.imdb_id
          )))
        )
      ORDER BY cl.state_changed_at NULLS FIRST,cl.imdb_id
      LIMIT ${maxJobs}
      ON CONFLICT(run_id,idempotency_key) DO NOTHING
      RETURNING id`;
    if(inserted.length===0)await sql`UPDATE batch_runs SET status='completed',finished_at=now(),updated_at=now(),stop_reason='No hay entidades elegibles para la etapa y política de reintento seleccionadas' WHERE id=${run.id}`;
    return{id:run.id,jobs:inserted.length,stage:target,retryMode:mode};
  }catch(error){
    await sql`UPDATE batch_runs SET status='failed',finished_at=now(),updated_at=now(),stop_reason=${String(error?.message||error).slice(0,500)} WHERE id=${run.id}`;
    throw error;
  }
}

export async function setGlobalPause(paused,reason=''){
  const sql=db();
  await sql`UPDATE batch_runtime_control SET paused=${Boolean(paused)},pause_reason=${String(reason||'').slice(0,300)||null},updated_at=now(),updated_by='pikofilm-ui' WHERE singleton=true`;
}

export async function setRunStatus(id,status){
  const runId=Number(id),next=String(status||'');if(!Number.isFinite(runId)||!RUN_STATUSES.has(next))throw new Error('Estado de run inválido');const sql=db();
  if(next==='cancelled'){
    await sql`UPDATE batch_jobs SET status='cancelled',finished_at=COALESCE(finished_at,now()),updated_at=now() WHERE run_id=${runId} AND status IN('queued','retry_wait','leased')`;
    await sql`UPDATE batch_runs SET status='cancelled',finished_at=COALESCE(finished_at,now()),updated_at=now(),stop_reason=COALESCE(stop_reason,'Cancelado por el usuario') WHERE id=${runId} AND status NOT IN('completed','cancelled')`;
    return;
  }
  if(next==='paused'){await sql`UPDATE batch_runs SET status='paused',updated_at=now() WHERE id=${runId} AND status IN('queued','running')`;return;}
  if(next==='queued'){await sql`UPDATE batch_runs SET status='queued',updated_at=now(),finished_at=NULL WHERE id=${runId} AND status='paused'`;return;}
  throw new Error('Transición manual no permitida');
}

export async function updateSourceLimit({source,enabled,maxConcurrency,minIntervalMs,dailyBudget}){
  const s=String(source||'');if(!SOURCES.has(s))throw new Error('Fuente no permitida');const sql=db();
  const concurrency=clampInt(maxConcurrency,0,16,1),interval=clampInt(minIntervalMs,0,600000,1000);
  const rawBudget=String(dailyBudget??'').trim(),budget=rawBudget===''?null:clampInt(rawBudget,0,100000,0);
  await sql`UPDATE batch_source_limits SET enabled=${Boolean(enabled)},max_concurrency=${concurrency},min_interval_ms=${interval},daily_budget=${budget},updated_at=now() WHERE source=${s}`;
}
