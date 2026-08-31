-- Explicitly authorized direct-main cleanup on 2026-08-31.
-- batch_job_steps belonged to the retired legacy Batch runtime/UI.
-- The writer service is removed and /admin/batch now redirects to Operations.
DROP TABLE IF EXISTS public.batch_job_steps;
