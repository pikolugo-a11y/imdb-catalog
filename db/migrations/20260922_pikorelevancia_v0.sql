BEGIN;

CREATE TABLE IF NOT EXISTS series_relevance_assessments (
  imdb_id text PRIMARY KEY CHECK (imdb_id ~ '^tt[0-9]+$'),
  formula_version text NOT NULL,
  score numeric(5,1) NOT NULL CHECK (score BETWEEN 0 AND 100),
  confidence numeric(5,1) NOT NULL CHECK (confidence BETWEEN 0 AND 100),
  recommendation text NOT NULL CHECK (recommendation IN ('muy_alta','alta','remojo','baja','muy_baja','datos_insuficientes')),
  title_snapshot text,
  evidence jsonb NOT NULL DEFAULT '{}'::jsonb,
  factors jsonb NOT NULL DEFAULT '[]'::jsonb,
  source_health jsonb NOT NULL DEFAULT '{}'::jsonb,
  assessed_at timestamptz NOT NULL DEFAULT now(),
  next_review_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS series_relevance_next_review_idx
  ON series_relevance_assessments(next_review_at)
  WHERE next_review_at IS NOT NULL;

COMMIT;
