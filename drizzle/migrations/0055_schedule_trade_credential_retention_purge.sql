-- lovable-cron-fallback-reviewed: 1 run/day — GDPR retention is time-based, not event-based; nothing in the app fires 14 days after a rejection.
CREATE OR REPLACE FUNCTION public.purge_rejected_trade_credentials_dispatch()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM net.http_post(
    url := 'https://dcrauiygaezoduwdjmsm.supabase.co/functions/v1/purge-rejected-trade-credentials',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Lovable-Context', 'cron'
    ),
    body := '{}'::jsonb
  );
END;
$$;

REVOKE ALL ON FUNCTION public.purge_rejected_trade_credentials_dispatch() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.purge_rejected_trade_credentials_dispatch() TO service_role;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'purge-rejected-trade-credentials') THEN
    PERFORM cron.unschedule('purge-rejected-trade-credentials');
  END IF;
  PERFORM cron.schedule(
    'purge-rejected-trade-credentials',
    '20 3 * * *',
    $cron$ SELECT public.purge_rejected_trade_credentials_dispatch(); $cron$
  );
END$$;