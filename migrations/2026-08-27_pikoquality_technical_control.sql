CREATE TABLE IF NOT EXISTS plex_technical_control (
  id smallint PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  armed boolean NOT NULL DEFAULT false,
  requested_state text NOT NULL DEFAULT 'stopped' CHECK (requested_state IN ('running','paused','stopped')),
  actual_state text NOT NULL DEFAULT 'stopped' CHECK (actual_state IN ('running','pausing','paused','stopped','error','completed')),
  worker_id text,
  heartbeat_at timestamptz,
  started_at timestamptz,
  paused_at timestamptz,
  stopped_at timestamptz,
  completed_at timestamptz,
  last_error text,
  last_batch_ok integer NOT NULL DEFAULT 0,
  last_batch_failed integer NOT NULL DEFAULT 0,
  last_batch_ms integer,
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO plex_technical_control(id,armed,requested_state,actual_state)
VALUES(1,false,'stopped','stopped')
ON CONFLICT(id) DO NOTHING;

CREATE INDEX IF NOT EXISTS plex_technical_state_status_type_idx
ON plex_technical_state(snapshot_status, needs_refresh, rating_key);
