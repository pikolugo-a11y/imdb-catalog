import 'server-only';
import {db} from './db';

const allowedStatuses=new Set(['queued','running','succeeded','failed','partial','cancelled']);
const allowedKinds=new Set(['individual','batch','system']);
const clean=(value,max)=>String(value||'').trim().slice(0,max);

export async function getOperationsOverview(filters={}){
  const sql=db();
  const q=clean(filters.q,160);
  const status=allowedStatuses.has(String(filters.status||''))?String(filters.status):'';
  const kind=allowedKinds.has(String(filters.kind||''))?String(filters.kind):'';
  const process=clean(filters.process,80);
  const entity=clean(filters.entity,120);
  const source=clean(filters.source,80);
  const period=String(filters.period||'30d');
  const since=period==='24h'?'24 hours':period==='7d'?'7 days':'30 days';
  const like='%'+q+'%';
  const page=Math.max(1,Number(filters.page)||1),pageSize=50,offset=(page-1)*pageSize;
  const hasFilters=Boolean(q||status||kind||process||entity||source||period!=='30d');

  const[summary,health,activeRuns,incidents,searchResults]=await Promise.all([
    sql`WITH active_errors AS (
      SELECT e.*
      FROM process_run_errors e
      WHERE e.occurred_at>=now()-interval '30 days'
        AND e.resolved_at IS NULL
        AND NOT EXISTS (
          SELECT 1 FROM process_runs later
          WHERE later.process_code=e.process_code
            AND later.requested_at>e.occurred_at
            AND later.technical_status='succeeded'
            AND COALESCE(later.entity_type,'')=COALESCE(e.entity_type,'')
            AND COALESCE(later.entity_id,'')=COALESCE(e.entity_id,'')
        )
    ), incident_groups AS (
      SELECT process_code,COALESCE(step,'') step,COALESCE(error_code,error_class,'MESSAGE:'||left(message,120)) error_key,COALESCE(source,'') source
      FROM active_errors
      GROUP BY process_code,COALESCE(step,''),COALESCE(error_code,error_class,'MESSAGE:'||left(message,120)),COALESCE(source,'')
    )
    SELECT
      count(*) FILTER (WHERE technical_status IN ('queued','running'))::int AS active,
      count(*) FILTER (WHERE requested_at>=now()-interval '24 hours')::int AS runs_24h,
      count(*) FILTER (WHERE technical_status='succeeded' AND requested_at>=now()-interval '24 hours')::int AS succeeded_24h,
      count(*) FILTER (WHERE technical_status='failed' AND requested_at>=now()-interval '24 hours')::int AS failed_24h,
      (SELECT count(*)::int FROM active_errors) AS active_error_occurrences,
      (SELECT count(*)::int FROM incident_groups) AS active_incidents
    FROM process_runs`,
    sql`SELECT
      COALESCE((SELECT desired_state FROM batch_engine_control WHERE singleton_id=1),'running') AS engine_state,
      (SELECT count(*)::int FROM batch_run_control WHERE closed_at IS NULL) AS active_batches,
      (SELECT count(*)::int FROM batch_run_items WHERE status IN ('leased','running') AND lease_until IS NOT NULL AND lease_until<now()) AS expired_leases,
      (SELECT count(*)::int FROM process_runs WHERE technical_status IN ('queued','running')) AS active_runs,
      (SELECT count(*)::int FROM process_runs WHERE technical_status IN ('queued','running') AND COALESCE(last_heartbeat_at,started_at,requested_at)<now()-interval '15 minutes') AS stale_runs,
      (SELECT count(*)::int FROM process_runs WHERE technical_status='running' AND started_at<now()-interval '2 hours') AS long_running`,
    sql`SELECT r.run_id,r.process_code,r.run_kind,r.trigger_source,r.executor,r.technical_status,r.functional_result,
               r.entity_type,r.entity_id,r.requested_at,r.started_at,r.last_heartbeat_at,r.duration_ms,r.items_total,r.items_processed,r.error_count,
               (COALESCE(r.last_heartbeat_at,r.started_at,r.requested_at)<now()-interval '15 minutes') AS stale,
               EXISTS(SELECT 1 FROM batch_run_control brc WHERE brc.run_id=r.run_id AND brc.closed_at IS NULL) AS controllable_batch,
               COALESCE(
                 (SELECT sr.title FROM series_reference sr WHERE sr.show_rating_key::text=r.entity_id LIMIT 1),
                 (SELECT COALESCE(m.title_es,m.title,m.original_title) FROM movies m WHERE m.imdb_id=r.entity_id LIMIT 1),
                 (SELECT p.name FROM people p WHERE p.tmdb_person_id=r.entity_id LIMIT 1)
               ) AS entity_label
        FROM process_runs r
        WHERE r.technical_status IN ('queued','running')
        ORDER BY (COALESCE(r.last_heartbeat_at,r.started_at,r.requested_at)<now()-interval '15 minutes') DESC,r.requested_at DESC`,
    sql`WITH candidates AS (
      SELECT e.*,
        EXISTS (
          SELECT 1 FROM process_runs later
          WHERE later.process_code=e.process_code
            AND later.requested_at>e.occurred_at
            AND later.technical_status='succeeded'
            AND COALESCE(later.entity_type,'')=COALESCE(e.entity_type,'')
            AND COALESCE(later.entity_id,'')=COALESCE(e.entity_id,'')
        ) AS auto_resolved
      FROM process_run_errors e
      WHERE e.occurred_at>=now()-interval '30 days'
    ), active AS (
      SELECT * FROM candidates WHERE resolved_at IS NULL AND auto_resolved=false
    )
    SELECT process_code,COALESCE(step,'') step,COALESCE(error_code,error_class,'MESSAGE:'||left(message,120)) error_key,COALESCE(source,'') source,
           count(*)::int occurrences,min(occurred_at) first_seen,max(occurred_at) last_seen,
           count(DISTINCT run_id)::int affected_runs,
           count(DISTINCT concat_ws(':',entity_type,entity_id))::int affected_entities,
           (array_agg(message ORDER BY occurred_at DESC))[1] message,
           ((array_agg(error_id ORDER BY occurred_at DESC))[1])::text sample_error_id,
           (array_agg(run_id ORDER BY occurred_at DESC))[1] sample_run_id
    FROM active
    GROUP BY process_code,COALESCE(step,''),COALESCE(error_code,error_class,'MESSAGE:'||left(message,120)),COALESCE(source,'')
    ORDER BY max(occurred_at) DESC
    LIMIT 20`,
    hasFilters?sql`SELECT DISTINCT r.run_id,r.process_code,r.run_kind,r.trigger_source,r.executor,r.technical_status,r.functional_result,
               r.entity_type,r.entity_id,r.requested_at,r.duration_ms,r.error_count,
               CASE
                 WHEN ${q}='' THEN 'Filtros aplicados'
                 WHEN r.run_id::text=${q} THEN 'Run ID exacto'
                 WHEN r.entity_id=${q} THEN 'Entidad exacta'
                 WHEN EXISTS(SELECT 1 FROM batch_run_control brc WHERE brc.run_id=r.run_id AND brc.run_id::text=${q}) THEN 'Batch ID exacto'
                 WHEN lower(r.process_code)=lower(${q}) THEN 'Proceso exacto'
                 WHEN EXISTS(SELECT 1 FROM movies m WHERE m.imdb_id=r.entity_id AND (COALESCE(m.title_es,'') ILIKE ${like} OR COALESCE(m.title,'') ILIKE ${like} OR COALESCE(m.original_title,'') ILIKE ${like})) THEN 'Título'
                 WHEN EXISTS(SELECT 1 FROM people p WHERE p.tmdb_person_id=r.entity_id AND COALESCE(p.name,'') ILIKE ${like}) THEN 'Persona'
                 WHEN EXISTS(SELECT 1 FROM batch_run_items bi WHERE bi.batch_run_id=r.run_id AND (bi.item_id::text=${q} OR COALESCE(bi.entity_id,'') ILIKE ${like})) THEN 'Batch / item'
                 WHEN r.process_code ILIKE ${like} THEN 'Proceso'
                 WHEN COALESCE(r.entity_id,'') ILIKE ${like} THEN 'Entidad'
                 WHEN EXISTS(SELECT 1 FROM process_run_errors e WHERE e.run_id=r.run_id AND (e.message ILIKE ${like} OR COALESCE(e.error_code,'') ILIKE ${like} OR COALESCE(e.source,'') ILIKE ${like})) THEN 'Error o fuente'
                 WHEN EXISTS(SELECT 1 FROM process_run_events ev WHERE ev.run_id=r.run_id AND (COALESCE(ev.message,'') ILIKE ${like} OR COALESCE(ev.step,'') ILIKE ${like})) THEN 'Evento o paso'
                 ELSE 'Contexto técnico'
               END AS match_reason
        FROM process_runs r
        WHERE r.requested_at>=now()-${since}::interval
          AND (${status}='' OR r.technical_status=${status})
          AND (${kind}='' OR r.run_kind=${kind})
          AND (${process}='' OR r.process_code ILIKE ${'%'+process+'%'})
          AND (${entity}='' OR COALESCE(r.entity_id,'') ILIKE ${'%'+entity+'%'})
          AND (${source}='' OR COALESCE(r.executor,'') ILIKE ${'%'+source+'%'} OR EXISTS(SELECT 1 FROM process_run_errors e WHERE e.run_id=r.run_id AND COALESCE(e.source,'') ILIKE ${'%'+source+'%'}))
          AND (${q}='' OR (
            r.run_id::text=${q} OR r.process_code ILIKE ${like} OR COALESCE(r.entity_id,'') ILIKE ${like}
            OR COALESCE(r.correlation_key,'') ILIKE ${like} OR COALESCE(r.idempotency_key,'') ILIKE ${like}
            OR r.context::text ILIKE ${like}
            OR EXISTS(SELECT 1 FROM movies m WHERE m.imdb_id=r.entity_id AND (COALESCE(m.title_es,'') ILIKE ${like} OR COALESCE(m.title,'') ILIKE ${like} OR COALESCE(m.original_title,'') ILIKE ${like}))
            OR EXISTS(SELECT 1 FROM people p WHERE p.tmdb_person_id=r.entity_id AND COALESCE(p.name,'') ILIKE ${like})
            OR EXISTS(SELECT 1 FROM batch_run_items bi WHERE bi.batch_run_id=r.run_id AND (bi.item_id::text=${q} OR COALESCE(bi.entity_id,'') ILIKE ${like}))
            OR EXISTS(SELECT 1 FROM process_run_errors e WHERE e.run_id=r.run_id AND (e.message ILIKE ${like} OR COALESCE(e.error_code,'') ILIKE ${like} OR COALESCE(e.error_class,'') ILIKE ${like} OR COALESCE(e.source,'') ILIKE ${like}))
            OR EXISTS(SELECT 1 FROM process_run_events ev WHERE ev.run_id=r.run_id AND (COALESCE(ev.message,'') ILIKE ${like} OR COALESCE(ev.step,'') ILIKE ${like} OR ev.data::text ILIKE ${like}))
          ))
        ORDER BY r.requested_at DESC
        LIMIT ${pageSize+1} OFFSET ${offset}`:Promise.resolve([])
  ]);
  return{summary:summary[0]||{},health:health[0]||{},activeRuns,incidents,searchResults:searchResults.slice(0,pageSize),searchHasMore:searchResults.length>pageSize,searchPage:page,query:q,hasFilters};
}

export async function getRunDetail(runId){
  const sql=db();
  const[runs,events,errors,children,batchItems,laterSuccess]=await Promise.all([
    sql`SELECT * FROM process_runs WHERE run_id=${runId}::uuid LIMIT 1`,
    sql`SELECT event_id,occurred_at,event_type,step,entity_type,entity_id,message,duration_ms,data
        FROM process_run_events WHERE run_id=${runId}::uuid ORDER BY occurred_at ASC,event_id ASC`,
    sql`SELECT error_id,occurred_at,process_code,entity_type,entity_id,step,error_code,error_class,message,source,
               retryable,retry_attempt,resolved_at,resolution,detail
        FROM process_run_errors WHERE run_id=${runId}::uuid ORDER BY occurred_at ASC,error_id ASC`,
    sql`SELECT run_id,process_code,technical_status,functional_result,entity_type,entity_id,requested_at,duration_ms,error_count
        FROM process_runs WHERE parent_run_id=${runId}::uuid ORDER BY requested_at ASC`,
    sql`SELECT item_id,entity_type,entity_id,status,attempt_count,last_error,started_at,finished_at
        FROM batch_run_items WHERE batch_run_id=${runId}::uuid ORDER BY position ASC`,
    sql`SELECT later.run_id,later.requested_at
        FROM process_runs current
        JOIN process_runs later ON later.process_code=current.process_code
          AND later.requested_at>current.requested_at
          AND later.technical_status='succeeded'
          AND COALESCE(later.entity_type,'')=COALESCE(current.entity_type,'')
          AND COALESCE(later.entity_id,'')=COALESCE(current.entity_id,'')
        WHERE current.run_id=${runId}::uuid
        ORDER BY later.requested_at DESC LIMIT 1`
  ]);
  const run=runs[0]||null;
  const unresolved=errors.filter(e=>!e.resolved_at);
  const incidentState=unresolved.length===0?'resolved':laterSuccess[0]?'auto_resolved':'active';
  return{run,events,errors,children,batchItems,laterSuccess:laterSuccess[0]||null,incidentState};
}
