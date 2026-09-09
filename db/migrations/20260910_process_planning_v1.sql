BEGIN;

CREATE TABLE IF NOT EXISTS process_plans (
  plan_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  series_key text NULL,
  process_code text NOT NULL,
  domain text NOT NULL,
  title text NOT NULL,
  workload_key text NULL,
  status text NOT NULL DEFAULT 'pending_planning' CHECK (status IN ('pending_planning','planned','delayed','dispatched','completed','cancelled','expired')),
  origin text NOT NULL DEFAULT 'automatic' CHECK (origin IN ('automatic','user','system')),
  earliest_at timestamptz NULL,
  planned_at timestamptz NULL,
  latest_at timestamptz NULL,
  priority smallint NOT NULL DEFAULT 50 CHECK (priority BETWEEN 0 AND 100),
  protected boolean NOT NULL DEFAULT false,
  deliberate_peak boolean NOT NULL DEFAULT false,
  estimated_load numeric(14,3) NULL CHECK (estimated_load IS NULL OR estimated_load >= 0),
  planned_volume integer NOT NULL DEFAULT 1 CHECK (planned_volume > 0),
  recurrence_rule jsonb NULL,
  dispatch_run_id uuid NULL REFERENCES process_runs(run_id) ON DELETE SET NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (latest_at IS NULL OR earliest_at IS NULL OR latest_at >= earliest_at),
  CHECK (planned_at IS NULL OR earliest_at IS NULL OR planned_at >= earliest_at),
  CHECK (planned_at IS NULL OR latest_at IS NULL OR planned_at <= latest_at)
);

CREATE UNIQUE INDEX IF NOT EXISTS process_plans_workload_active_uidx
  ON process_plans (process_code, workload_key)
  WHERE workload_key IS NOT NULL AND status IN ('pending_planning','planned','delayed','dispatched');
CREATE INDEX IF NOT EXISTS process_plans_calendar_idx
  ON process_plans (planned_at, priority DESC)
  WHERE status IN ('planned','delayed','dispatched');
CREATE INDEX IF NOT EXISTS process_plans_pending_idx
  ON process_plans (latest_at, priority DESC)
  WHERE status='pending_planning';

COMMIT;
