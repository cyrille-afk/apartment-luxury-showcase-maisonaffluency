CREATE TABLE public.internal_job_tokens (
  name text PRIMARY KEY,
  token text NOT NULL DEFAULT encode(extensions.gen_random_bytes(32),'hex'),
  created_at timestamptz NOT NULL DEFAULT now()
);
REVOKE ALL ON public.internal_job_tokens FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.internal_job_tokens TO service_role;
ALTER TABLE public.internal_job_tokens ENABLE ROW LEVEL SECURITY;
INSERT INTO public.internal_job_tokens(name) VALUES ('scheduler') ON CONFLICT DO NOTHING;

CREATE OR REPLACE FUNCTION public._internal_job_token()
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT token FROM public.internal_job_tokens WHERE name = 'scheduler'
$$;
REVOKE ALL ON FUNCTION public._internal_job_token() FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.webhook_worker_watchdog_dispatch()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM net.http_post(
    url := 'https://dcrauiygaezoduwdjmsm.supabase.co/functions/v1/monitor-webhook-worker',
    headers := jsonb_build_object('Content-Type','application/json','Lovable-Context','cron',
      'x-internal-token', public._internal_job_token()),
    body := '{}'::jsonb);
END; $$;

CREATE OR REPLACE FUNCTION public.notify_trade_fraud_alert()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE payload jsonb;
BEGIN
  IF NEW.status = 'flagged' AND NEW.fraud_flags IS NOT NULL
     AND NEW.fraud_flags @> ARRAY['DUPLICATE_DOCUMENT_FINGERPRINT'] THEN
    IF TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM NEW.status OR OLD.fraud_flags IS DISTINCT FROM NEW.fraud_flags THEN
      payload := jsonb_build_object('type',TG_OP,'table',TG_TABLE_NAME,'schema',TG_TABLE_SCHEMA,
        'record', jsonb_build_object('id',NEW.id,'company_name',NEW.company_name,'email',NEW.email,
          'document_hash',NEW.document_hash,'fraud_flags',NEW.fraud_flags,'status',NEW.status));
      PERFORM net.http_post(
        url := 'https://dcrauiygaezoduwdjmsm.supabase.co/functions/v1/trade-fraud-alert',
        body := payload,
        headers := jsonb_build_object('Content-Type','application/json','x-internal-token', public._internal_job_token()),
        timeout_milliseconds := 5000);
    END IF;
  END IF;
  RETURN NEW;
END; $$;
REVOKE ALL ON FUNCTION public.notify_trade_fraud_alert() FROM PUBLIC, anon, authenticated;

SELECT cron.schedule('sync-currency-rates-twice-daily','0 6,18 * * *', $cmd$
  select net.http_post(
    url:='https://dcrauiygaezoduwdjmsm.supabase.co/functions/v1/sync-currency-rates',
    headers:=jsonb_build_object('Content-Type','application/json','x-internal-token', public._internal_job_token()),
    body:=jsonb_build_object('time', now())) as request_id;
$cmd$);

SELECT cron.schedule('escalate-unacknowledged-purchase-orders','0 8 * * *', $cmd$
  select net.http_post(
    url:='https://dcrauiygaezoduwdjmsm.supabase.co/functions/v1/escalate-unacknowledged-purchase-orders',
    headers:=jsonb_build_object('Content-Type','application/json','x-internal-token', public._internal_job_token()),
    body:=jsonb_build_object('time', now())) as request_id;
$cmd$);