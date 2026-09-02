BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '120s';

-- PRE-V4 P3: remove first-generation Batch tables.
-- Intentionally no CASCADE: any unexpected external dependency must abort.
DROP TABLE IF EXISTS public.batch_process_state;
DROP TABLE IF EXISTS public.batch_jobs;
DROP TABLE IF EXISTS public.batch_runs;
DROP TABLE IF EXISTS public.batch_runtime_control;
DROP TABLE IF EXISTS public.batch_source_limits;

-- Clean up legacy sequences only if they remain after table ownership cleanup.
DROP SEQUENCE IF EXISTS public.batch_jobs_id_seq;
DROP SEQUENCE IF EXISTS public.batch_runs_id_seq;

COMMIT;
