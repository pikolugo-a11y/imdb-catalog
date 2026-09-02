DO $$
BEGIN
  IF to_regclass('public.movie_quality_runs') IS NOT NULL THEN
    RAISE EXCEPTION 'movie_quality_runs still exists';
  END IF;
  IF to_regclass('public.movie_quality_runs_id_seq') IS NOT NULL THEN
    RAISE EXCEPTION 'movie_quality_runs_id_seq still exists';
  END IF;
END
$$;

SELECT to_regclass('public.movie_quality_runs') AS movie_quality_runs,
       to_regclass('public.movie_quality_runs_id_seq') AS movie_quality_runs_id_seq;
