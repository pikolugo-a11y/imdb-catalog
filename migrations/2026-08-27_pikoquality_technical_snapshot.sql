ALTER TABLE plex_streams ADD COLUMN IF NOT EXISTS width integer;
ALTER TABLE plex_streams ADD COLUMN IF NOT EXISTS height integer;
ALTER TABLE plex_streams ADD COLUMN IF NOT EXISTS frame_rate text;

CREATE TABLE IF NOT EXISTS plex_technical_state (
  rating_key text PRIMARY KEY REFERENCES plex_items(rating_key) ON DELETE CASCADE,
  probe_fingerprint text,
  technical_fingerprint text,
  snapshot_status text NOT NULL DEFAULT 'missing',
  snapshot_version text NOT NULL DEFAULT '1',
  needs_refresh boolean NOT NULL DEFAULT true,
  captured_at timestamptz,
  source_updated_at timestamptz,
  last_probe_at timestamptz,
  last_error text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT plex_technical_state_status_check CHECK (snapshot_status IN ('missing','pending','ready','stale','error'))
);

CREATE INDEX IF NOT EXISTS idx_plex_technical_state_refresh
  ON plex_technical_state(needs_refresh, snapshot_status, updated_at);

CREATE INDEX IF NOT EXISTS idx_plex_technical_state_technical_fingerprint
  ON plex_technical_state(technical_fingerprint)
  WHERE technical_fingerprint IS NOT NULL;
