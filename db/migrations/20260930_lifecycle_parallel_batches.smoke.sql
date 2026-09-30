BEGIN;

DO $$
DECLARE
  lc1 uuid := '00000000-0000-4000-8000-000000000101';
  lc2 uuid := '00000000-0000-4000-8000-000000000102';
  other1 uuid := '00000000-0000-4000-8000-000000000103';
  other2 uuid := '00000000-0000-4000-8000-000000000104';
  blocked boolean := false;
BEGIN
  INSERT INTO process_runs (
    run_id, process_code, run_kind, trigger_source, executor, technical_status,
    entity_type, entity_id, correlation_key, idempotency_key
  ) VALUES
    (lc1, 'PROC-LC-001', 'batch', 'migration_smoke', 'github_actions', 'running',
     'title', 'tt9000101', 'lc-parallel-smoke-1', 'lc-parallel-smoke-1'),
    (lc2, 'PROC-LC-001', 'batch', 'migration_smoke', 'github_actions', 'running',
     'title', 'tt9000102', 'lc-parallel-smoke-2', 'lc-parallel-smoke-2'),
    (other1, 'PROC-BATCH-SMOKE-UNIQUE', 'batch', 'migration_smoke', 'github_actions', 'running',
     'system', 'other-1', 'batch-unique-smoke-1', 'batch-unique-smoke-1'),
    (other2, 'PROC-BATCH-SMOKE-UNIQUE', 'batch', 'migration_smoke', 'github_actions', 'running',
     'system', 'other-2', 'batch-unique-smoke-2', 'batch-unique-smoke-2');

  INSERT INTO batch_run_control(run_id,process_code,worker_pool,desired_state,requested_concurrency)
  VALUES
    (lc1,'PROC-LC-001','api','running',1),
    (lc2,'PROC-LC-001','api','running',1);

  BEGIN
    INSERT INTO batch_run_control(run_id,process_code,worker_pool,desired_state,requested_concurrency)
    VALUES(other1,'PROC-BATCH-SMOKE-UNIQUE','fast','running',1);

    INSERT INTO batch_run_control(run_id,process_code,worker_pool,desired_state,requested_concurrency)
    VALUES(other2,'PROC-BATCH-SMOKE-UNIQUE','fast','running',1);
  EXCEPTION
    WHEN unique_violation THEN
      blocked := true;
  END;

  IF NOT blocked THEN
    RAISE EXCEPTION 'generic process must still allow only one active Batch';
  END IF;

  IF (SELECT count(*) FROM batch_run_control WHERE process_code='PROC-LC-001' AND run_id IN (lc1,lc2)) <> 2 THEN
    RAISE EXCEPTION 'PROC-LC-001 must allow two active Batch controls';
  END IF;
END $$;

ROLLBACK;
