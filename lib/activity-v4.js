import 'server-only';
import {db} from './db';
import {processDisplay} from './process-display';

export const ACTIVITY_RETENTION_DAYS=30;
export const ACTIVITY_PAGE_SIZE=40;
export const ACTIVITY_PLAN_DETAIL_LIMIT=600;
export const ACTIVITY_DETAIL_CHILD_LIMIT=250;
export const ACTIVITY_DETAIL_ERROR_LIMIT=100;
export const ACTIVITY_PLANNER_HEALTH_MINUTES=90;

const DOMAIN_RULES=[
  ['plex',['PROC-NOV-009','PROC-NOV-008','PROC-NOV-010','PROC-SER-001','PROC-SER-002']],
  ['personas',['PROC-PER-001']],
  ['sagas',['PROC-SAGA-001','PROC-NOV-011']],
  ['novedades',['PROC-NOV-']],
  ['calidad',['PROC-ID-','PROC-IV-','PROC-DATA-','PROC-MOV-','PROC-SER-','PROC-PQ-']],
  ['catalogo',['PROC-LC-','PROC-PLAN-']],
];
const automaticSources=new Set(['quality_scheduler','catalog_admission','plex_sync_continuation','activity_planner','cron']);
const statusText={queued:'Pendiente',running:'En curso',succeeded:'Completado',partial:'Completado con incidencias',failed:'Falló',cancelled:'Cancelado'};
const resultText={updated:'Se produjeron cambios',no_change:'Comprobado: no había cambios',pending:'Quedó pendiente',blocked:'Necesita atención',not_found:'No se encontró',invalid:'Resultado no válido'};
const MADRID_DAY_FORMATTER=new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Madrid',year:'numeric',month:'2-digit',day:'2-digit'});
const UUID_RE=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function activityDomain(code=''){
  for(const [domain,rules] of DOMAIN_RULES){if(rules.some(rule=>rule.endsWith('-')?code.startsWith(rule):code===rule))return domain;}
  return 'catalogo';
}
export function activityOrigin(source=''){
  if(source==='plex'||source.startsWith('plex_'))return 'Plex';
  if(automaticSources.has(source)||source.includes('scheduler')||source.includes('automatic'))return 'Automático';
  if(source.includes('manual')||source==='manual')return 'Tú';
  return 'PikoFilm';
}
function functionalSummary(row){
  if(row.technical_status==='failed')return 'No se pudo completar. Puede requerir revisión.';
  if(row.technical_status==='partial')return `${resultText[row.functional_result]||'Terminó con incidencias'}.`;
  if(row.technical_status==='running'||row.technical_status==='queued'){
    const done=Number(row.items_processed||0),total=Number(row.items_total||0);
    return total?`${done} de ${total} procesados.`:'Trabajo en curso.';
  }
  const base=resultText[row.functional_result]||'Proceso completado';
  const ok=Number(row.items_succeeded||0),failed=Number(row.items_failed||0),total=Number(row.items_total||0);
  if(total)return `${base}. ${ok||Math.max(0,total-failed)} correctos${failed?`, ${failed} con incidencia`:''}.`;
  return `${base}.`;
}
function mapRun(row){
  const process=processDisplay(row.process_code);
  return {...row,kind:'run',domain:activityDomain(row.process_code),title:process.name,entityLabel:row.entity_label||row.entity_id||null,statusLabel:statusText[row.technical_status]||row.technical_status,resultLabel:functionalSummary(row),originLabel:activityOrigin(row.trigger_source),attention:['failed','partial'].includes(row.technical_status)||row.functional_result==='blocked',technicalHref:`/admin/runs/${row.run_id}`};
}
function mapPlan(row){
  const status={pending_planning:'Pendiente de planificar',planned:'Planificado',delayed:'Retrasado',dispatched:'En curso',completed:'Completado',cancelled:'Cancelado',expired:'Expirado'}[row.status]||row.status;
  const load=Number(row.estimated_load||0);return {...row,kind:'plan',statusLabel:status,loadLabel:load>=3600?'Alta':load>=900?'Media':'Baja',originLabel:row.origin==='user'?'Tú':'Automático',attention:row.status==='delayed'||row.status==='expired'};
}
const entityLabelJoin=`
  LEFT JOIN movies am ON am.imdb_id=CASE WHEN r.entity_id LIKE 'tt%' THEN r.entity_id ELSE r.after_compact->>'imdb_id' END
  LEFT JOIN people ap ON r.entity_type='person' AND ap.tmdb_person_id=r.entity_id
  LEFT JOIN saga_collections ascg ON r.entity_type IN('saga_collection','saga') AND ascg.tmdb_collection_id=r.entity_id`;
const entityLabelSelect=`COALESCE(am.title_es,am.title,am.original_title,ap.name,ascg.name,r.entity_id) AS entity_label`;

export async function getActivityTimeline({domain='todo',q='',page=1,limit=ACTIVITY_PAGE_SIZE}={}){
  const sql=db(),safePage=Math.max(1,Number(page)||1),safeLimit=Math.max(10,Math.min(100,Number(limit)||ACTIVITY_PAGE_SIZE)),offset=(safePage-1)*safeLimit,term=String(q||'').trim().slice(0,120);
  const params=[ACTIVITY_RETENTION_DAYS,safeLimit+1,offset],clauses=[`r.requested_at>=now()-($1::int*interval '1 day')`,`r.parent_run_id IS NULL`];
  let i=4;
  if(domain&&domain!=='todo'&&domain!=='errores'){
    const rules=DOMAIN_RULES.find(([d])=>d===domain)?.[1]||[];if(rules.length){clauses.push(`(${rules.map(rule=>{params.push(rule.endsWith('-')?`${rule}%`:rule);return rule.endsWith('-')?`r.process_code LIKE $${i++}`:`r.process_code=$${i++}`;}).join(' OR ')})`);}
  }
  if(domain==='errores')clauses.push(`(r.technical_status IN ('failed','partial') OR r.functional_result='blocked')`);
  if(term){params.push(`%${term}%`);clauses.push(`(r.process_code ILIKE $${i} OR COALESCE(r.entity_id,'') ILIKE $${i} OR COALESCE(r.context::text,'') ILIKE $${i} OR COALESCE(r.after_compact::text,'') ILIKE $${i} OR COALESCE(am.title_es,'') ILIKE $${i} OR COALESCE(am.title,'') ILIKE $${i} OR COALESCE(am.original_title,'') ILIKE $${i} OR COALESCE(ap.name,'') ILIKE $${i} OR COALESCE(ascg.name,'') ILIKE $${i})`);i++;}
  const rows=await sql.query(`SELECT r.*,${entityLabelSelect} FROM process_runs r ${entityLabelJoin} WHERE ${clauses.join(' AND ')} ORDER BY r.requested_at DESC LIMIT $2 OFFSET $3`,params);
  return{items:rows.slice(0,safeLimit).map(mapRun),hasMore:rows.length>safeLimit,page:safePage};
}

export async function getActivityRunDetail(runId){
  if(!UUID_RE.test(String(runId||'')))return null;
  const sql=db();const [root,children,errors]=await Promise.all([
    sql.query(`SELECT r.*,${entityLabelSelect} FROM process_runs r ${entityLabelJoin} WHERE r.run_id=$1::uuid LIMIT 1`,[runId]),
    sql.query(`SELECT r.*,${entityLabelSelect},count(*) OVER()::int total_count FROM process_runs r ${entityLabelJoin} WHERE r.parent_run_id=$1::uuid ORDER BY r.requested_at ASC LIMIT ${ACTIVITY_DETAIL_CHILD_LIMIT}`,[runId]),
    sql.query(`SELECT error_id,occurred_at,entity_type,entity_id,retryable,resolved_at,count(*) OVER()::int total_count FROM process_run_errors WHERE run_id=$1::uuid OR run_id IN(SELECT run_id FROM process_runs WHERE parent_run_id=$1::uuid) ORDER BY occurred_at DESC LIMIT ${ACTIVITY_DETAIL_ERROR_LIMIT}`,[runId])
  ]);
  const childrenTotal=Number(children[0]?.total_count||children.length),errorsTotal=Number(errors[0]?.total_count||errors.length);
  const safeErrors=errors.map(error=>({...error,functionalMessage:error.entity_id?`No se pudo completar el trabajo sobre ${error.entity_id}.`:'No se pudo completar una parte de esta actividad.',nextStep:error.resolved_at?'La incidencia ya está resuelta.':error.retryable?'PikoFilm puede volver a intentarlo automáticamente.':'Puede requerir revisión.'}));
  return root[0]?{run:mapRun(root[0]),children:children.map(mapRun),errors:safeErrors,childrenTotal,errorsTotal,childrenTruncated:childrenTotal>children.length,errorsTruncated:errorsTotal>errors.length}:null;
}

const planScope=`status IN ('pending_planning','planned','delayed','dispatched') AND (planned_at IS NULL OR planned_at<now()+interval '30 days') AND (latest_at IS NULL OR latest_at>=now()-interval '1 day')`;
export async function getActivityCalendar(){
  const sql=db();
  const [rows,capacityRows,statsRows,dailyRows,plannerRows]=await Promise.all([
    sql.query(`SELECT * FROM process_plans WHERE ${planScope} ORDER BY COALESCE(planned_at,latest_at) ASC NULLS LAST,priority DESC LIMIT ${ACTIVITY_PLAN_DETAIL_LIMIT}`),
    sql.query(`WITH daily AS (SELECT date_trunc('day',requested_at) AS bucket_day,COALESCE(sum(duration_ms),0)::numeric/1000 load_seconds FROM process_runs WHERE requested_at>=now()-interval '21 days' AND technical_status IN('succeeded','partial') AND duration_ms>0 GROUP BY 1) SELECT COALESCE(percentile_cont(0.75) WITHIN GROUP(ORDER BY load_seconds),0)::float AS baseline FROM daily`),
    sql.query(`SELECT count(*)::int total_plans,count(*) FILTER(WHERE status='pending_planning')::int pending_plans,COALESCE(sum(planned_volume) FILTER(WHERE status='pending_planning'),0)::bigint pending_volume,count(*) FILTER(WHERE status='delayed')::int delayed_plans,COALESCE(sum(planned_volume) FILTER(WHERE planned_at>=now() AND planned_at<now()+interval '7 days'),0)::bigint next7_volume FROM process_plans WHERE ${planScope}`),
    sql.query(`SELECT ((planned_at AT TIME ZONE 'Europe/Madrid')::date)::text day,count(*)::int plan_count,COALESCE(sum(estimated_load),0)::float8 estimated_load,COALESCE(sum(planned_volume),0)::bigint volume,COALESCE(sum(planned_volume) FILTER(WHERE protected),0)::bigint protected_volume,bool_or(deliberate_peak) deliberate_peak FROM process_plans WHERE ${planScope} AND planned_at IS NOT NULL GROUP BY 1 ORDER BY 1`),
    sql.query(`SELECT run_id,technical_status,functional_result,requested_at,finished_at FROM process_runs WHERE process_code='PROC-PLAN-002' AND parent_run_id IS NULL ORDER BY requested_at DESC LIMIT 1`)
  ]);
  const plans=rows.map(mapPlan),baseline=Math.max(900,Number(capacityRows[0]?.baseline||0)),stats=statsRows[0]||{};
  const daily=dailyRows.map(day=>({day:String(day.day),planCount:Number(day.plan_count||0),estimatedLoad:Number(day.estimated_load||0),volume:Number(day.volume||0),protectedVolume:Number(day.protected_volume||0),deliberatePeak:Boolean(day.deliberate_peak),baseline}));
  const overloads=daily.filter(day=>day.estimatedLoad>baseline*1.5).map(day=>({...day,reason:day.deliberatePeak?'Pico deliberado por encima de la carga habitual.':'La carga prevista sigue muy por encima de la carga habitual incluso tras la planificación actual.'}));
  const latestPlanner=plannerRows[0]||null,plannerAgeMs=latestPlanner?Date.now()-new Date(latestPlanner.requested_at).getTime():Infinity,plannerHealthy=Boolean(latestPlanner&&['succeeded','running'].includes(latestPlanner.technical_status)&&plannerAgeMs<=ACTIVITY_PLANNER_HEALTH_MINUTES*60000);
  const planner={healthy:plannerHealthy,lastRunAt:latestPlanner?.requested_at||null,status:latestPlanner?.technical_status||'never',runId:latestPlanner?.run_id||null};
  const totalPlans=Number(stats.total_plans||0),counts={pending:Number(stats.pending_volume||0),pendingPlans:Number(stats.pending_plans||0),attention:Number(stats.delayed_plans||0)+overloads.filter(x=>!x.deliberatePeak).length+(plannerHealthy?0:1),next7:Number(stats.next7_volume||0)};
  return{plans,counts,overloads,daily,planner,baselineLoadSeconds:baseline,totalPlans,truncated:totalPlans>plans.length,detailLimit:ACTIVITY_PLAN_DETAIL_LIMIT};
}

export async function getActivitySummary(){
  const sql=db();const [row]=await sql.query(`
    SELECT
      (SELECT count(*) FROM process_runs WHERE requested_at>=now()-interval '30 days' AND parent_run_id IS NULL AND technical_status IN('queued','running'))::int active,
      (SELECT count(*) FROM catalog_lifecycle WHERE lifecycle_state IN ('IDENTITY_REVIEW_REQUIRED','MOVIE_FILE_REVIEW','SERIES_REVIEW'))::int lifecycle_attention,
      (SELECT count(*) FROM movies m LEFT JOIN catalog_lifecycle cl USING(imdb_id) LEFT JOIN catalog_exclusions ex USING(imdb_id) WHERE cl.imdb_id IS NULL AND ex.imdb_id IS NULL)::int lifecycle_missing,
      (SELECT count(*) FROM catalog_lifecycle cl LEFT JOIN movies m USING(imdb_id) WHERE m.imdb_id IS NULL)::int lifecycle_orphaned,
      (SELECT count(*) FROM catalog_lifecycle cl JOIN movies m USING(imdb_id) WHERE (m.type IN ('Serie','Miniserie') AND cl.lifecycle_state IN ('MOVIE_FILE_PENDING','MOVIE_FILE_REVIEW')) OR (m.type='Película' AND cl.lifecycle_state IN ('SERIES_SYNC_PENDING','SERIES_REVIEW')))::int lifecycle_incompatible,
      (SELECT count(*) FROM catalog_candidates c LEFT JOIN movies m USING(imdb_id) LEFT JOIN catalog_exclusions ex USING(imdb_id) WHERE m.imdb_id IS NULL AND ex.imdb_id IS NULL AND c.eligibility_status='eligible')::int news_ready,
      (SELECT count(*) FROM plex_items p LEFT JOIN plex_external_ids x ON x.rating_key=p.rating_key AND x.provider='imdb' WHERE p.active AND p.item_type IN('movie','show') AND x.external_id IS NULL AND NOT EXISTS(SELECT 1 FROM catalog_candidates c WHERE c.source_snapshot->>'identityMode'='tmdb_only' AND COALESCE(c.source_snapshot->>'plexRatingKey',c.source_snapshot->>'ratingKey')=p.rating_key AND c.eligibility_status IN('eligible','processing','catalogued')))::int plex_identity_attention`);
  const breakdown={lifecycle:Number(row?.lifecycle_attention||0),integrity:Number(row?.lifecycle_missing||0)+Number(row?.lifecycle_orphaned||0)+Number(row?.lifecycle_incompatible||0),news:Number(row?.news_ready||0)+Number(row?.plex_identity_attention||0)};
  return{active:Number(row?.active||0),attention:breakdown.lifecycle+breakdown.integrity+breakdown.news,attentionBreakdown:breakdown};
}
