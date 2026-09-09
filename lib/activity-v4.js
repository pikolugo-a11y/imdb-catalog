import 'server-only';
import {db} from './db';
import {processDisplay} from './process-display';

export const ACTIVITY_RETENTION_DAYS=30;
export const ACTIVITY_PAGE_SIZE=40;

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
  if(row.technical_status==='failed')return 'No se pudo completar. Consulta el detalle si necesita intervención.';
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
  return {...row,kind:'run',domain:activityDomain(row.process_code),title:process.name,statusLabel:statusText[row.technical_status]||row.technical_status,resultLabel:functionalSummary(row),originLabel:activityOrigin(row.trigger_source),attention:['failed','partial'].includes(row.technical_status)||row.functional_result==='blocked',technicalHref:`/admin/runs/${row.run_id}`};
}
function mapPlan(row){
  const status={pending_planning:'Pendiente de planificar',planned:'Planificado',delayed:'Retrasado',dispatched:'En curso',completed:'Completado',cancelled:'Cancelado',expired:'Expirado'}[row.status]||row.status;
  const load=Number(row.estimated_load||0);return {...row,kind:'plan',statusLabel:status,loadLabel:load>=3600?'Alta':load>=900?'Media':'Baja',originLabel:row.origin==='user'?'Tú':'Automático',attention:row.status==='delayed'||row.status==='expired'};
}

export async function getActivityTimeline({domain='todo',q='',page=1,limit=ACTIVITY_PAGE_SIZE}={}){
  const sql=db(),safePage=Math.max(1,Number(page)||1),safeLimit=Math.max(10,Math.min(100,Number(limit)||ACTIVITY_PAGE_SIZE)),offset=(safePage-1)*safeLimit,term=String(q||'').trim().slice(0,120);
  const params=[ACTIVITY_RETENTION_DAYS,safeLimit+1,offset],clauses=[`r.requested_at>=now()-($1::int*interval '1 day')`,`r.parent_run_id IS NULL`];
  let i=4;
  if(domain&&domain!=='todo'&&domain!=='errores'){
    const rules=DOMAIN_RULES.find(([d])=>d===domain)?.[1]||[];if(rules.length){clauses.push(`(${rules.map(rule=>{params.push(rule.endsWith('-')?`${rule}%`:rule);return rule.endsWith('-')?`r.process_code LIKE $${i++}`:`r.process_code=$${i++}`;}).join(' OR ')})`);}
  }
  if(domain==='errores')clauses.push(`(r.technical_status IN ('failed','partial') OR r.functional_result='blocked')`);
  if(term){params.push(`%${term}%`);clauses.push(`(r.process_code ILIKE $${i} OR COALESCE(r.entity_id,'') ILIKE $${i} OR COALESCE(r.context::text,'') ILIKE $${i} OR COALESCE(r.after_compact::text,'') ILIKE $${i})`);i++;}
  const rows=await sql.query(`SELECT r.* FROM process_runs r WHERE ${clauses.join(' AND ')} ORDER BY r.requested_at DESC LIMIT $2 OFFSET $3`,params);
  return{items:rows.slice(0,safeLimit).map(mapRun),hasMore:rows.length>safeLimit,page:safePage};
}

export async function getActivityRunDetail(runId){
  const sql=db();const [root,children,errors]=await Promise.all([
    sql.query(`SELECT * FROM process_runs WHERE run_id=$1::uuid LIMIT 1`,[runId]),
    sql.query(`SELECT * FROM process_runs WHERE parent_run_id=$1::uuid ORDER BY requested_at ASC LIMIT 250`,[runId]),
    sql.query(`SELECT error_id,occurred_at,entity_type,entity_id,message,retryable,resolved_at,resolution FROM process_run_errors WHERE run_id=$1::uuid OR run_id IN(SELECT run_id FROM process_runs WHERE parent_run_id=$1::uuid) ORDER BY occurred_at DESC LIMIT 100`,[runId])
  ]);return root[0]?{run:mapRun(root[0]),children:children.map(mapRun),errors}:null;
}

export async function getActivityCalendar(){
  const sql=db();
  const rows=await sql.query(`SELECT * FROM process_plans WHERE status IN ('pending_planning','planned','delayed','dispatched') AND (planned_at IS NULL OR planned_at<now()+interval '30 days') AND (latest_at IS NULL OR latest_at>=now()-interval '1 day') ORDER BY COALESCE(planned_at,latest_at) ASC NULLS LAST,priority DESC LIMIT 600`);
  const plans=rows.map(mapPlan),now=Date.now(),week=now+7*86400000;
  const counts={pending:plans.filter(x=>x.status==='pending_planning').reduce((n,x)=>n+Number(x.planned_volume||0),0),attention:plans.filter(x=>x.attention).length,next7:plans.filter(x=>x.planned_at&&new Date(x.planned_at).getTime()<=week).reduce((n,x)=>n+Number(x.planned_volume||0),0)};
  return{plans,counts};
}

export async function getActivitySummary(){
  const sql=db();const [row]=await sql.query(`SELECT count(*) FILTER(WHERE technical_status IN('queued','running'))::int active,count(*) FILTER(WHERE technical_status IN('failed','partial') OR functional_result='blocked')::int attention FROM process_runs WHERE requested_at>=now()-interval '30 days'`);
  return{active:Number(row?.active||0),attention:Number(row?.attention||0)};
}
