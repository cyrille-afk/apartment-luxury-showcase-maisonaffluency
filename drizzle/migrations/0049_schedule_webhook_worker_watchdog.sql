-- lovable-cron-fallback-reviewed: 144 runs/day — a dead queue worker emits no event to react to, so only a timer can detect it; 10 min bounds payment-processing downtime
CREATE OR REPLACE FUNCTION public.webhook_worker_watchdog_dispatch()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM net.http_post(
    url := 'https://dcrauiygaezoduwdjmsm.supabase.co/functions/v1/monitor-webhook-worker',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Lovable-Context', 'cron'
    ),
    body := '{}'::jsonb
  );
END;
$$;

REVOKE ALL ON FUNCTION public.webhook_worker_watchdog_dispatch() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.webhook_worker_watchdog_dispatch() TO service_role;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'monitor-webhook-worker') THEN
    PERFORM cron.unschedule('monitor-webhook-worker');
  END IF;
  PERFORM cron.schedule(
    'monitor-webhook-worker',
    '*/10 * * * *',
    $cron$ SELECT public.webhook_worker_watchdog_dispatch(); $cron$
  );
END$$;
