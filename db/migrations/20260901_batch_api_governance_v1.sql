CREATE TABLE IF NOT EXISTS batch_api_source_limits (
  source text PRIMARY KEY,
  enabled boolean NOT NULL DEFAULT true,
  daily_limit integer,
  batch_share_percent integer NOT NULL DEFAULT 90 CHECK(batch_share_percent BETWEEN 1 AND 99),
  max_concurrency integer NOT NULL DEFAULT 1 CHECK(max_concurrency BETWEEN 1 AND 32),
  breaker_state text NOT NULL DEFAULT 'closed' CHECK(breaker_state IN('closed','open')),
  blocked_until timestamptz,
  consecutive_errors integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS batch_api_source_usage (
  source text NOT NULL REFERENCES batch_api_source_limits(source) ON DELETE CASCADE,
  usage_date date NOT NULL DEFAULT (now() AT TIME ZONE 'UTC')::date,
  batch_calls integer NOT NULL DEFAULT 0,
  manual_calls integer NOT NULL DEFAULT 0,
  rate_limited integer NOT NULL DEFAULT 0,
  errors integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(source,usage_date)
);

CREATE TABLE IF NOT EXISTS batch_api_source_leases (
  lease_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source text NOT NULL REFERENCES batch_api_source_limits(source) ON DELETE CASCADE,
  owner text NOT NULL,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS batch_api_source_leases_source_expiry_idx ON batch_api_source_leases(source,expires_at);

INSERT INTO batch_api_source_limits(source,daily_limit,batch_share_percent,max_concurrency)
VALUES
 ('tmdb',NULL,90,3),
 ('omdb',100000,90,2),
 ('mdblist',25000,90,2)
ON CONFLICT(source) DO NOTHING;

CREATE OR REPLACE FUNCTION batch_api_acquire_source(
  p_source text,
  p_lane text,
  p_owner text,
  p_lease_seconds integer DEFAULT 30
) RETURNS TABLE(lease_id uuid, allowed boolean, reason text, used integer, budget integer, blocked_until timestamptz)
LANGUAGE plpgsql AS $$
DECLARE
  cfg batch_api_source_limits%ROWTYPE;
  usage_row batch_api_source_usage%ROWTYPE;
  active_leases integer;
  lane_budget integer;
  total_used integer;
  new_lease uuid;
BEGIN
  IF p_lane NOT IN ('batch','manual') THEN RAISE EXCEPTION 'lane inválido'; END IF;
  SELECT * INTO cfg FROM batch_api_source_limits WHERE source=p_source FOR UPDATE;
  IF NOT FOUND OR NOT cfg.enabled THEN RETURN QUERY SELECT NULL::uuid,false,'source_disabled',0,0,cfg.blocked_until; RETURN; END IF;
  IF cfg.breaker_state='open' AND (cfg.blocked_until IS NULL OR cfg.blocked_until>now()) THEN RETURN QUERY SELECT NULL::uuid,false,'breaker_open',0,COALESCE(cfg.daily_limit,0),cfg.blocked_until; RETURN; END IF;
  IF cfg.breaker_state='open' AND cfg.blocked_until<=now() THEN
    UPDATE batch_api_source_limits SET breaker_state='closed',blocked_until=NULL,consecutive_errors=0,updated_at=now() WHERE source=p_source;
  END IF;
  DELETE FROM batch_api_source_leases WHERE source=p_source AND expires_at<=now();
  SELECT count(*)::int INTO active_leases FROM batch_api_source_leases WHERE source=p_source AND expires_at>now();
  IF active_leases>=cfg.max_concurrency THEN RETURN QUERY SELECT NULL::uuid,false,'concurrency',0,COALESCE(cfg.daily_limit,0),NULL::timestamptz; RETURN; END IF;
  INSERT INTO batch_api_source_usage(source,usage_date) VALUES(p_source,(now() AT TIME ZONE 'UTC')::date) ON CONFLICT DO NOTHING;
  SELECT * INTO usage_row FROM batch_api_source_usage WHERE source=p_source AND usage_date=(now() AT TIME ZONE 'UTC')::date FOR UPDATE;
  total_used=usage_row.batch_calls+usage_row.manual_calls;
  IF cfg.daily_limit IS NOT NULL THEN
    lane_budget=CASE WHEN p_lane='batch' THEN floor(cfg.daily_limit*cfg.batch_share_percent/100.0)::int ELSE cfg.daily_limit END;
    IF (p_lane='batch' AND usage_row.batch_calls>=lane_budget) OR total_used>=cfg.daily_limit THEN
      RETURN QUERY SELECT NULL::uuid,false,CASE WHEN p_lane='batch' THEN 'batch_quota' ELSE 'daily_quota' END,CASE WHEN p_lane='batch' THEN usage_row.batch_calls ELSE total_used END,lane_budget,NULL::timestamptz; RETURN;
    END IF;
  ELSE lane_budget=NULL; END IF;
  INSERT INTO batch_api_source_leases(source,owner,expires_at) VALUES(p_source,p_owner,now()+(GREATEST(5,LEAST(COALESCE(p_lease_seconds,30),300))||' seconds')::interval) RETURNING batch_api_source_leases.lease_id INTO new_lease;
  UPDATE batch_api_source_usage SET batch_calls=batch_calls+CASE WHEN p_lane='batch' THEN 1 ELSE 0 END,manual_calls=manual_calls+CASE WHEN p_lane='manual' THEN 1 ELSE 0 END,updated_at=now() WHERE source=p_source AND usage_date=(now() AT TIME ZONE 'UTC')::date;
  RETURN QUERY SELECT new_lease,true,NULL::text,CASE WHEN p_lane='batch' THEN usage_row.batch_calls+1 ELSE total_used+1 END,lane_budget,NULL::timestamptz;
END $$;

CREATE OR REPLACE FUNCTION batch_api_release_source(p_lease_id uuid) RETURNS void LANGUAGE sql AS $$ DELETE FROM batch_api_source_leases WHERE lease_id=p_lease_id $$;
