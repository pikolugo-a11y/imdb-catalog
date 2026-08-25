import 'server-only';
import {db} from './db';

const STALE_MINUTES=15;

export async function cleanupStaleRuns(){
  const sql=db();
  // Web/serverless executions cannot legitimately stay alive for hours. A short
  // stale window prevents a killed Vercel invocation from looking "running"
  // forever in Admin. Worker runs are left with the historical 2h safeguard.
  await sql`UPDATE pipeline_runs SET status='failed',finished_at=now(),error_count=GREATEST(COALESCE(error_count,0),1),summary=COALESCE(summary,'{}'::jsonb)||jsonb_build_object('stage','abandoned','message','Ejecución web interrumpida: sin heartbeat durante más de 15 minutos'),updated_at=now() WHERE status='running' AND source='web' AND updated_at<now()-(${STALE_MINUTES}||' minutes')::interval`;
  await sql`UPDATE pipeline_runs SET status='failed',finished_at=now(),error_count=GREATEST(COALESCE(error_count,0),1),summary=COALESCE(summary,'{}'::jsonb)||'{"stage":"abandoned","message":"Marcado automáticamente por falta de heartbeat durante más de 2 horas"}'::jsonb,updated_at=now() WHERE status='running' AND source<>'web' AND updated_at<now()-interval '2 hours'`;
  try{await sql`UPDATE admin_job_requests SET status='failed',finished_at=now(),error=COALESCE(error,'Solicitud abandonada: sin cierre durante más de 2 horas') WHERE status='dispatched' AND requested_at<now()-interval '2 hours'`}catch{}
}
export async function startRun(jobType,source='web',summary={}){const sql=db();await cleanupStaleRuns().catch(()=>{});const [r]=await sql`INSERT INTO pipeline_runs(job_type,source,status,started_at,processed_count,added_count,updated_count,skipped_count,error_count,summary,created_at,updated_at) VALUES(${jobType},${source},'running',now(),0,0,0,0,0,${JSON.stringify(summary)}::jsonb,now(),now()) RETURNING id,started_at`;return r}
export async function progressRun(id,patch={}){const sql=db();await sql`UPDATE pipeline_runs SET processed_count=COALESCE(${patch.processed??null},processed_count),added_count=COALESCE(${patch.added??null},added_count),updated_count=COALESCE(${patch.updated??null},updated_count),skipped_count=COALESCE(${patch.skipped??null},skipped_count),error_count=COALESCE(${patch.errors??null},error_count),summary=COALESCE(summary,'{}'::jsonb)||${JSON.stringify(patch.summary||{})}::jsonb,updated_at=now() WHERE id=${id}`}
export async function finishRun(id,status='success',patch={}){const sql=db();await sql`UPDATE pipeline_runs SET status=${status},finished_at=now(),processed_count=COALESCE(${patch.processed??null},processed_count),added_count=COALESCE(${patch.added??null},added_count),updated_count=COALESCE(${patch.updated??null},updated_count),skipped_count=COALESCE(${patch.skipped??null},skipped_count),error_count=COALESCE(${patch.errors??null},error_count),summary=COALESCE(summary,'{}'::jsonb)||${JSON.stringify(patch.summary||{})}::jsonb,updated_at=now() WHERE id=${id}`}
export async function audit(eventType,entityType,entityId,action,payload={}){const sql=db();try{await sql`INSERT INTO admin_events(event_type,entity_type,entity_id,action,payload,created_at) VALUES(${eventType},${entityType},${entityId||null},${action},${JSON.stringify(payload)}::jsonb,now())`}catch{}}
export function errorInfo(e){return{message:e?.message||String(e),name:e?.name||'Error'}}
