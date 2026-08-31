BEGIN;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM batch_engine_control WHERE singleton_id = 1 AND desired_state = 'running') THEN
    RAISE EXCEPTION 'batch_engine_control singleton missing';
  END IF;
END $$;

WITH parent AS (
  INSERT INTO process_runs (
    process_code, run_kind, trigger_source, executor, technical_status,
    entity_type, entity_id, correlation_key, idempotency_key,
    items_total, items_processed, items_succeeded, items_failed, items_pending
  ) VALUES (
    'PROC-BATCH-SMOKE', 'batch', 'migration_smoke', 'github_actions', 'running',
    'system', 'batch-engine-smoke', 'batch-engine-smoke-correlation', 'batch-engine-smoke-idempotency',
    2, 0, 0, 0, 2
  )
  RETURNING run_id
), control AS (
  INSERT INTO batch_run_control (run_id, process_code, worker_pool, requested_concurrency)
  SELECT run_id, 'PROC-BATCH-SMOKE', 'fast', 2 FROM parent
  RETURNING run_id
)
INSERT INTO batch_run_items (batch_run_id, entity_type, entity_id, position)
SELECT run_id, 'title', 'tt0000001', 0 FROM control
UNION ALL
SELECT run_id, 'title', 'tt0000002', 1 FROM control;

DO $$
DECLARE
  n integer;
BEGIN
  SELECT count(*) INTO n
  FROM batch_run_items i
  JOIN batch_run_control c ON c.run_id = i.batch_run_id
  WHERE c.process_code = 'PROC-BATCH-SMOKE' AND i.status = 'queued';
  IF n <> 2 THEN
    RAISE EXCEPTION 'expected 2 queued items, found %', n;
  END IF;
END $$;

ROLLBACK;
