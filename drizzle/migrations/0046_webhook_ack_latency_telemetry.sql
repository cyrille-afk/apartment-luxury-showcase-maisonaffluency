-- 1. Ack latency telemetry on the queue table
ALTER TABLE public.webhook_events
  ADD COLUMN IF NOT EXISTS ack_ms integer;

COMMENT ON COLUMN public.webhook_events.ack_ms IS
  'Milliseconds the stripe-webhook handler took to verify the signature, enqueue the event and return 200 to Stripe.';

CREATE INDEX IF NOT EXISTS idx_webhook_events_created_at_ack
  ON public.webhook_events (created_at DESC)
  INCLUDE (ack_ms);

-- 2. Realtime: the admin queue panel needs live status transitions
ALTER TABLE public.webhook_events REPLICA IDENTITY FULL;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'webhook_events'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.webhook_events;
  END IF;
END$$;

-- 3. Overview RPC now reports ack latency + recent event stream
CREATE OR REPLACE FUNCTION public.admin_queue_overview()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  result jsonb;
  latency jsonb;
  recent jsonb;
BEGIN
  IF NOT (public.has_role(auth.uid(), 'admin'::app_role)
          OR public.has_role(auth.uid(), 'super_admin'::app_role)) THEN
    RAISE EXCEPTION 'not authorised';
  END IF;

  SELECT jsonb_build_object(
    'samples',     count(*) FILTER (WHERE ack_ms IS NOT NULL),
    'avg_ms',      round(avg(ack_ms) FILTER (WHERE ack_ms IS NOT NULL))::int,
    'p95_ms',      (percentile_disc(0.95) WITHIN GROUP (ORDER BY ack_ms) FILTER (WHERE ack_ms IS NOT NULL))::int,
    'max_ms',      max(ack_ms),
    'over_2s',     count(*) FILTER (WHERE ack_ms > 2000)
  )
  INTO latency
  FROM public.webhook_events
  WHERE created_at > now() - interval '24 hours';

  SELECT coalesce(jsonb_agg(row_to_json(r)), '[]'::jsonb)
  INTO recent
  FROM (
    SELECT id, event_id, event_type, status, attempts, ack_ms, created_at, processed_at
    FROM public.webhook_events
    ORDER BY created_at DESC
    LIMIT 12
  ) r;

  SELECT jsonb_build_object(
    'pending',       count(*) FILTER (WHERE status = 'pending'),
    'processing',    count(*) FILTER (WHERE status = 'processing'),
    'parked',        count(*) FILTER (WHERE status = 'failed'),
    'processed_24h', count(*) FILTER (WHERE status = 'processed' AND processed_at > now() - interval '24 hours'),
    'has_work',      public.webhook_events_has_work(),
    'cron_armed',    EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'process-webhook-events'),
    'ack_latency',   latency,
    'recent',        recent
  )
  INTO result
  FROM public.webhook_events;

  RETURN result;
END;
$function$;