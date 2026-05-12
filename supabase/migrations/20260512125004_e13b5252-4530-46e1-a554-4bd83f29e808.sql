
SELECT cron.unschedule('security-monitor-15min')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'security-monitor-15min');

SELECT cron.schedule(
  'security-monitor-15min',
  '*/15 * * * *',
  $$
  SELECT net.http_post(
    url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'SUPABASE_URL' LIMIT 1)
           || '/functions/v1/monitor-security-anomalies',
    headers := jsonb_build_object(
      'Content-Type','application/json',
      'Authorization','Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'SUPABASE_SERVICE_ROLE_KEY' LIMIT 1)
    ),
    body := '{}'::jsonb
  );
  $$
);
