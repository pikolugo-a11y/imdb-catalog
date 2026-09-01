import 'server-only';
import {db} from './db';

const allowedStatuses=new Set(['queued','running','succeeded','failed','partial','cancelled']);
const allowedKinds=new Set(['individual','batch','system']);

export async function getOperationsOverview(filters={}){
  const sql=db();
  const status=allowedStatuses.has(String(filters.status||''))?String(filters.status):'';
  const kind=allowedKinds.has(String(filters.kind||''))?String(filters.kind):'';
  const process=String(filters.process||'').trim().slice(0,80);
  const entity=String(filters.entity||'').trim().slice(0,120);

  const[summary,runs,errors,processes]=await Promise.all([
    sql`SELECT
      count(*) FILTER (WHERE technical_status IN ('queued','running'))::int AS active,
      count(*) FILTER (WHERE technical_status='failed' AND requested_at>=now()-interval '24 hours')::int AS failed_24h,
      count(*) FILTER (WHERE requested_at>=now()-interval '24 hours')::int AS runs_24h,
      count(*) FILTER (WHERE technical_status='succeeded' AND requested_at>=now()-interval '24 hours')::int AS succeeded_24h,
      COALESCE(round(avg(duration_ms) FILTER (WHERE duration_ms IS NOT NULL AND requested_at>=now()-interval '24 hours'))::bigint,0) AS avg_duration_ms,
      (SELECT count(*)::int FROM process_run_errors WHERE resolved_at IS NULL) AS open_errors
    FROM process_runs`,
    sql`SELECT run_id,parent_run_id,process_code,run_kind,trigger_source,executor,technical_status,functional_result,
               entity_type,entity_id,requested_at,started_at,finished_at,duration_ms,items_total,items_processed,
               items_succeeded,items_failed,items_pending,external_calls,retry_count,error_count
        FROM process_runs
        WHERE (${status}='' OR technical_status=${status})
          AND (${kind}='' OR run_kind=${kind})
          AND (${process}='' OR process_code ILIKE ${'%'+process+'%'})
          AND (${entity}='' OR entity_id ILIKE ${'%'+entity+'%'})
        ORDER BY requested_at DESC
        LIMIT 100`,
    sql`SELECT e.error_id,e.run_id,e.occurred_at,e.process_code,e.entity_type,e.entity_id,e.step,e.error_code,
               e.error_class,e.message,e.source,e.retryable,e.retry_attempt,e.resolved_at,e.resolution,
               r.technical_status
        FROM process_run_errors e
        JOIN process_runs r ON r.run_id=e.run_id
        WHERE e.resolved_at IS NULL
        ORDER BY e.occurred_at DESC
        LIMIT 25`,
    sql`SELECT process_code,count(*)::int AS total,
               count(*) FILTER (WHERE technical_status='succeeded')::int AS succeeded,
               count(*) FILTER (WHERE technical_status IN ('failed','partial'))::int AS problematic,
               max(requested_at) AS last_run_at
        FROM process_runs
        GROUP BY process_code
        ORDER BY max(requested_at) DESC
        LIMIT 40`
  ]);

  return{summary:summary[0]||{},runs,errors,processes};
}

export async function getRunDetail(runId){
  const sql=db();
  const[runs,events,errors,children,batchItems]=await Promise.all([
    sql`SELECT * FROM process_runs WHERE run_id=${runId}::uuid LIMIT 1`,
    sql`SELECT event_id,occurred_at,event_type,step,entity_type,entity_id,message,duration_ms,data
        FROM process_run_events WHERE run_id=${runId}::uuid ORDER BY occurred_at ASC,event_id ASC`,
    sql`SELECT error_id,occurred_at,process_code,entity_type,entity_id,step,error_code,error_class,message,source,
               retryable,retry_attempt,resolved_at,resolution,detail
        FROM process_run_errors WHERE run_id=${runId}::uuid ORDER BY occurred_at ASC,error_id ASC`,
    sql`SELECT run_id,process_code,technical_status,functional_result,entity_type,entity_id,requested_at,duration_ms,error_count
        FROM process_runs WHERE parent_run_id=${runId}::uuid ORDER BY requested_at ASC`,
    sql`SELECT item_id,entity_type,entity_id,status,attempt_count,last_error,started_at,finished_at
        FROM batch_run_items WHERE batch_run_id=${runId}::uuid ORDER BY position ASC`
  ]);
  return{run:runs[0]||null,events,errors,children,batchItems};
}