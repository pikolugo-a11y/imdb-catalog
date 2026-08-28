BEGIN;

CREATE TABLE IF NOT EXISTS process_runs (
  run_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_run_id uuid NULL REFERENCES process_runs(run_id) ON DELETE SET NULL,
  process_code text NOT NULL,
  run_kind text NOT NULL DEFAULT 'individual' CHECK (run_kind IN ('individual','batch','system')),
  trigger_source text NOT NULL,
  executor text NOT NULL,
  technical_status text NOT NULL DEFAULT 'queued' CHECK (technical_status IN ('queued','running','succeeded','failed','partial','cancelled')),
  functional_result text NULL CHECK (functional_result IN ('updated','no_change','pending','blocked','not_found','invalid')),
  entity_type text NULL,
  entity_id text NULL,
  correlation_key text NULL,
  idempotency_key text NULL,
  requested_at timestamptz NOT NULL DEFAULT now(),
  started_at timestamptz NULL,
  finished_at timestamptz NULL,
  last_heartbeat_at timestamptz NULL,
  duration_ms bigint NULL CHECK (duration_ms IS NULL OR duration_ms >= 0),
  items_total integer NULL CHECK (items_total IS NULL OR items_total >= 0),
  items_processed integer NULL CHECK (items_processed IS NULL OR items_processed >= 0),
  items_succeeded integer NULL CHECK (items_succeeded IS NULL OR items_succeeded >= 0),
  items_failed integer NULL CHECK (items_failed IS NULL OR items_failed >= 0),
  items_pending integer NULL CHECK (items_pending IS NULL OR items_pending >= 0),
  external_calls integer NOT NULL DEFAULT 0 CHECK (external_calls >= 0),
  retry_count integer NOT NULL DEFAULT 0 CHECK (retry_count >= 0),
  error_count integer NOT NULL DEFAULT 0 CHECK (error_count >= 0),
  metrics jsonb NULL,
  context jsonb NULL,
  before_compact jsonb NULL,
  after_compact jsonb NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS process_run_errors (
  error_id bigserial PRIMARY KEY,
  run_id uuid NOT NULL REFERENCES process_runs(run_id) ON DELETE CASCADE,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  process_code text NOT NULL,
  entity_type text NULL,
  entity_id text NULL,
  step text NULL,
  error_code text NULL,
  error_class text NULL,
  message text NOT NULL,
  source text NULL,
  retryable boolean NOT NULL DEFAULT false,
  retry_attempt integer NOT NULL DEFAULT 0 CHECK (retry_attempt >= 0),
  resolved_at timestamptz NULL,
  resolution text NULL,
  detail jsonb NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS process_run_events (
  event_id bigserial PRIMARY KEY,
  run_id uuid NOT NULL REFERENCES process_runs(run_id) ON DELETE CASCADE,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  event_type text NOT NULL,
  step text NULL,
  entity_type text NULL,
  entity_id text NULL,
  message text NULL,
  duration_ms bigint NULL CHECK (duration_ms IS NULL OR duration_ms >= 0),
  data jsonb NULL
);

CREATE INDEX IF NOT EXISTS process_runs_recent_idx ON process_runs (requested_at DESC);
CREATE INDEX IF NOT EXISTS process_runs_process_time_idx ON process_runs (process_code, requested_at DESC);
CREATE INDEX IF NOT EXISTS process_runs_parent_status_idx ON process_runs (parent_run_id, technical_status, requested_at DESC) WHERE parent_run_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS process_runs_active_idx ON process_runs (technical_status, requested_at DESC) WHERE technical_status IN ('queued','running');
CREATE INDEX IF NOT EXISTS process_runs_failed_partial_idx ON process_runs (requested_at DESC) WHERE technical_status IN ('failed','partial');
CREATE INDEX IF NOT EXISTS process_runs_entity_idx ON process_runs (entity_type, entity_id, requested_at DESC) WHERE entity_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS process_runs_idempotency_key_uidx ON process_runs (process_code, idempotency_key) WHERE idempotency_key IS NOT NULL;
CREATE INDEX IF NOT EXISTS process_runs_correlation_key_idx ON process_runs (correlation_key) WHERE correlation_key IS NOT NULL;
CREATE INDEX IF NOT EXISTS process_run_errors_recent_idx ON process_run_errors (occurred_at DESC);
CREATE INDEX IF NOT EXISTS process_run_errors_open_idx ON process_run_errors (occurred_at DESC) WHERE resolved_at IS NULL;
CREATE INDEX IF NOT EXISTS process_run_errors_process_time_idx ON process_run_errors (process_code, occurred_at DESC);
CREATE INDEX IF NOT EXISTS process_run_errors_run_time_idx ON process_run_errors (run_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS process_run_events_run_time_idx ON process_run_events (run_id, occurred_at ASC);
CREATE INDEX IF NOT EXISTS process_run_events_type_time_idx ON process_run_events (event_type, occurred_at DESC);

COMMIT;
