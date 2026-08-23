import 'server-only';
import {db} from './db';

export const BATCH_STAGES=[
  'IDENTITY_PENDING','IDENTITY_VALIDATION','DATA_INCOMPLETE','PIKOSCORE_PENDING',
  'MOVIE_FILE_PENDING','SERIES_SYNC_PENDING','TECH_PENDING'
];
const RUN_STATUSES=new Set(['queued','running','paused','completed','cancelled','failed']);
const SOURCES=new Set(['fast','tmdb','wikidata','omdb','plex','filmaffinity']);

function clampInt(v,min,max,fallback){const n=Number.parseInt(v,10);return Number.isFinite(n)?Math.max(min,Math.min(max,n)):fallback}
function stageOf(v){const s=String(v||'').trim();if(!BATCH_STAGES.includes(s))throw new Error('Etapa batch no permitida');return s}

export async function getBatchControlOverview(){
  const sql=db();
  const [control,limits,runs,jobs]=await Promise.all([
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
      count(j.*) FILTER(WHERE j.status='skipped')::int skipped
      FROM batch_runs r LEFT JOIN batch_jobs j ON j.run_id=r.id
      GROUP BY r.id ORDER BY r.created_at DESC LIMIT 40`,
    sql`SELECT id,run_id,entity_type,entity_id,stage,status,attempt,priority,available_at,leased_until,worker_id,error_class,error_message,created_at,updated_at
      FROM batch_jobs ORDER BY created_at DESC LIMIT 50`
  ]);
  const summary=(runs||[]).reduce((a,r)=>{a.runs++;a.jobs+=r.jobs||0;a.queued+=r.queued||0;a.active+=r.active||0;a.retry+=r.retry_wait||0;a.review+=r.review||0;a.failed+=r.failed||0;return a},{runs:0,jobs:0,queued:0,active:0,retry:0,review:0,failed:0});
  return{control:control[0]||{paused:true,pause_reason:'Sin configuración'},limits,runs,jobs,summary};
}

export async function createStageRun({stage,limit=100,requestedBy='pikofilm-ui'}={}){
  const target=stageOf(stage),maxJobs=clampInt(limit,1,5000,100),sql=db();
  const [run]=await sql`INSERT INTO batch_runs(mode,target_stage,status,requested_by,limits) VALUES('stage',${target},'queued',${String(requestedBy).slice(0,80)},${JSON.stringify({max_jobs:maxJobs})}::jsonb) RETURNING id`;
  try{
    const inserted=await sql`INSERT INTO batch_jobs(run_id,entity_type,entity_id,stage,status,priority,available_at,idempotency_key)
      SELECT ${run.id},'title',cl.imdb_id,${target},'queued',100,now(),${target}||':'||cl.imdb_id
      FROM catalog_lifecycle cl
      WHERE cl.state=${target}
      ORDER BY cl.state_changed_at NULLS FIRST,cl.imdb_id
      LIMIT ${maxJobs}
      ON CONFLICT(run_id,idempotency_key) DO NOTHING
      RETURNING id`;
    if(inserted.length===0)await sql`UPDATE batch_runs SET status='completed',finished_at=now(),updated_at=now(),stop_reason='No hay entidades elegibles para la etapa' WHERE id=${run.id}`;
    return{id:run.id,jobs:inserted.length,stage:target};
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
