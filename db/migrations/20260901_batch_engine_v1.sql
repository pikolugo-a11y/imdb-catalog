BEGIN;

CREATE TABLE IF NOT EXISTS batch_engine_control (
  singleton_id smallint PRIMARY KEY DEFAULT 1 CHECK (singleton_id = 1),
  desired_state text NOT NULL DEFAULT 'running' CHECK (desired_state IN ('running','paused')),
  pause_reason text NULL,
  changed_by text NULL,
  changed_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO batch_engine_control (singleton_id, desired_state)
VALUES (1, 'running')
ON CONFLICT (singleton_id) DO NOTHING;

CREATE TABLE IF NOT EXISTS batch_run_control (
  run_id uuid PRIMARY KEY REFERENCES process_runs(run_id) ON DELETE CASCADE,
  process_code text NOT NULL,
  worker_pool text NOT NULL CHECK (worker_pool IN ('fast','api','plex')),
  desired_state text NOT NULL DEFAULT 'running' CHECK (desired_state IN ('running','paused','cancel_requested')),
  pause_reason text NULL,
  requested_concurrency integer NOT NULL DEFAULT 1 CHECK (requested_concurrency BETWEEN 1 AND 32),
  paused_at timestamptz NULL,
  resumed_at timestamptz NULL,
  cancel_requested_at timestamptz NULL,
  closed_at timestamptz NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS batch_run_items (
  item_id bigserial PRIMARY KEY,
  batch_run_id uuid NOT NULL REFERENCES batch_run_control(run_id) ON DELETE CASCADE,
  entity_type text NOT NULL,
  entity_id text NOT NULL,
  position integer NOT NULL CHECK (position >= 0),
  status text NOT NULL DEFAULT 'queued' CHECK (status IN ('queued','leased','running','succeeded','failed','skipped','cancelled')),
  child_run_id uuid NULL REFERENCES process_runs(run_id) ON DELETE SET NULL,
  lease_owner text NULL,
  lease_until timestamptz NULL,
  attempt_count integer NOT NULL DEFAULT 0 CHECK (attempt_count >= 0),
  last_error text NULL,
  started_at timestamptz NULL,
  finished_at timestamptz NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (batch_run_id, entity_type, entity_id),
  UNIQUE (batch_run_id, position)
);

CREATE UNIQUE INDEX IF NOT EXISTS batch_run_control_one_active_process_uidx
  ON batch_run_control (process_code)
  WHERE closed_at IS NULL;

CREATE INDEX IF NOT EXISTS batch_run_control_pool_state_idx
  ON batch_run_control (worker_pool, desired_state, created_at)
  WHERE closed_at IS NULL;

CREATE INDEX IF NOT EXISTS batch_run_items_claim_idx
  ON batch_run_items (batch_run_id, position)
  WHERE status = 'queued';

CREATE INDEX IF NOT EXISTS batch_run_items_lease_expiry_idx
  ON batch_run_items (lease_until)
  WHERE status IN ('leased','running') AND lease_until IS NOT NULL;

CREATE INDEX IF NOT EXISTS batch_run_items_status_idx
  ON batch_run_items (batch_run_id, status, position);

COMMIT;
