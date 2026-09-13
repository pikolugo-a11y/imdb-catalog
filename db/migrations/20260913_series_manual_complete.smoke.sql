DO $$
BEGIN
  IF to_regclass('public.series_quality_overrides') IS NULL THEN
    RAISE EXCEPTION 'Falta series_quality_overrides';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='series_quality_overrides' AND column_name='decision'
  ) THEN
    RAISE EXCEPTION 'Falta decision en series_quality_overrides';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.views
    WHERE table_schema='public' AND table_name='series_episode_effective_status'
  ) THEN
    RAISE EXCEPTION 'Falta series_episode_effective_status';
  END IF;
END $$;
