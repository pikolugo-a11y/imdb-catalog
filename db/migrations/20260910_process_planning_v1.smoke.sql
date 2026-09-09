DO $$ BEGIN
  IF to_regclass('public.process_plans') IS NULL THEN RAISE EXCEPTION 'process_plans missing'; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname='public' AND indexname='process_plans_calendar_idx') THEN RAISE EXCEPTION 'calendar index missing'; END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='process_plans' AND column_name='dispatch_run_id') THEN RAISE EXCEPTION 'dispatch_run_id missing'; END IF;
END $$;
