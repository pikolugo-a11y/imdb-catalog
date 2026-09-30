BEGIN;

DROP INDEX IF EXISTS batch_run_control_one_active_process_uidx;

CREATE UNIQUE INDEX batch_run_control_one_active_process_uidx
  ON batch_run_control (process_code)
  WHERE closed_at IS NULL
    AND process_code <> 'PROC-LC-001';

COMMIT;
