import 'server-only';
import {db} from './db';

export async function startRun(jobType,source='web',summary={}){
  const sql=db();
  const [r]=await sql`INSERT INTO pipeline_runs(job_type,source,status,started_at,processed_count,added_count,updated_count,skipped_count,error_count,summary,created_at,updated_at) VALUES(${jobType},${source},'running',now(),0,0,0,0,0,${JSON.stringify(summary)}::jsonb,now(),now()) RETURNING id,started_at`;
  return r;
}
export async function progressRun(id,patch={}){const sql=db();await sql`UPDATE pipeline_runs SET processed_count=COALESCE(${patch.processed??null},processed_count),added_count=COALESCE(${patch.added??null},added_count),updated_count=COALESCE(${patch.updated??null},updated_count),skipped_count=COALESCE(${patch.skipped??null},skipped_count),error_count=COALESCE(${patch.errors??null},error_count),summary=COALESCE(summary,'{}'::jsonb)||${JSON.stringify(patch.summary||{})}::jsonb,updated_at=now() WHERE id=${id}`}
export async function finishRun(id,status='success',patch={}){const sql=db();await sql`UPDATE pipeline_runs SET status=${status},finished_at=now(),processed_count=COALESCE(${patch.processed??null},processed_count),added_count=COALESCE(${patch.added??null},added_count),updated_count=COALESCE(${patch.updated??null},updated_count),skipped_count=COALESCE(${patch.skipped??null},skipped_count),error_count=COALESCE(${patch.errors??null},error_count),summary=COALESCE(summary,'{}'::jsonb)||${JSON.stringify(patch.summary||{})}::jsonb,updated_at=now() WHERE id=${id}`}
export async function audit(eventType,entityType,entityId,action,payload={}){const sql=db();try{await sql`INSERT INTO admin_events(event_type,entity_type,entity_id,action,payload,created_at) VALUES(${eventType},${entityType},${entityId||null},${action},${JSON.stringify(payload)}::jsonb,now())`}catch{/* schema may be pending during rollout */}}
export function errorInfo(e){return{message:e?.message||String(e),name:e?.name||'Error'}}
