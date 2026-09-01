BEGIN;
DO $$
BEGIN
  IF to_regprocedure('movie_physical_fingerprint(text)') IS NULL THEN
    RAISE EXCEPTION 'movie_physical_fingerprint(text) no existe';
  END IF;
END $$;
SELECT movie_physical_fingerprint('__pikofilm_smoke_missing__') IS NULL AS missing_rating_key_returns_null;
ROLLBACK;
