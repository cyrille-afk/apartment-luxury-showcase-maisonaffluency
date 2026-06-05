-- Idempotent: drop any prior schedule with the same name before re-creating.
SELECT cron.unschedule(jobid)
FROM cron.job
WHERE jobname = 'cad-fit-edit-audit-retention';

SELECT cron.schedule(
  'cad-fit-edit-audit-retention',
  '17 3 * * *',  -- daily 03:17 UTC
  $$DELETE FROM public.cad_fit_edit_audit WHERE created_at < now() - interval '90 days';$$
);