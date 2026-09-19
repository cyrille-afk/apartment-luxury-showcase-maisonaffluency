-- Worker health heartbeat + pending-age telemetry for the async webhook queue.

CREATE TABLE IF NOT EXISTS public.webhook_worker_health (
  worker TEXT PRIMARY KEY,
  last_start_at TIMESTAMPTZ,
  last_success_at TIMESTAMPTZ,
  last_failure_at TIMESTAMPTZ,
  last_error TEXT,
  consecutive_failures INTEGER NOT NULL DEFAULT 0,
  boot_ok BOOLEAN NOT NULL DEFAULT true,
  last_claimed INTEGER NOT NULL DEFAULT 0,
  last_processed INTEGER NOT NULL DEFAULT 0,
  last_failed INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT ON public.webhook_worker_health TO authenticated;
GRANT ALL ON public.webhook_worker_health TO service_role;

ALTER TABLE public.webhook_worker_health ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'webhook_worker_health'
      AND policyname = 'Admins can read worker health'
  ) THEN
    CREATE POLICY "Admins can read worker health"
      ON public.webhook_worker_health
      FOR SELECT
      TO authenticated
      USING (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'super_admin'::app_role));
  END IF;
END$$;

-- Heartbeat writer: called by the worker on every invocation (service role only).
CREATE OR REPLACE FUNCTION public.record_webhook_worker_heartbeat(
  p_worker TEXT,
  p_ok BOOLEAN,
  p_boot_ok BOOLEAN DEFAULT true,
  p_error TEXT DEFAULT NULL,
  p_claimed INTEGER DEFAULT 0,
  p_processed INTEGER DEFAULT 0,
  p_failed INTEGER DEFAULT 0
)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  INSERT INTO public.webhook_worker_health AS h (
    worker, last_start_at, last_success_at, last_failure_at, last_error,
    consecutive_failures, boot_ok, last_claimed, last_processed, last_failed, updated_at
  )
  VALUES (
    p_worker, now(),
    CASE WHEN p_ok THEN now() END,
    CASE WHEN p_ok THEN NULL ELSE now() END,
    CASE WHEN p_ok THEN NULL ELSE p_error END,
    CASE WHEN p_ok THEN 0 ELSE 1 END,
    p_boot_ok, p_claimed, p_processed, p_failed, now()
  )
  ON CONFLICT (worker) DO UPDATE SET
    last_start_at = now(),
    last_success_at = CASE WHEN p_ok THEN now() ELSE h.last_success_at END,
    last_failure_at = CASE WHEN p_ok THEN h.last_failure_at ELSE now() END,
    last_error = CASE WHEN p_ok THEN NULL ELSE p_error END,
    consecutive_failures = CASE WHEN p_ok THEN 0 ELSE h.consecutive_failures + 1 END,
    boot_ok = p_boot_ok,
    last_claimed = p_claimed,
    last_processed = p_processed,
    last_failed = p_failed,
    updated_at = now();
$$;

REVOKE ALL ON FUNCTION public.record_webhook_worker_heartbeat(TEXT, BOOLEAN, BOOLEAN, TEXT, INTEGER, INTEGER, INTEGER) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.record_webhook_worker_heartbeat(TEXT, BOOLEAN, BOOLEAN, TEXT, INTEGER, INTEGER, INTEGER) TO service_role;

-- Overview RPC: add worker heartbeat + pending-event age tracking.
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
  health jsonb;
  ages jsonb;
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
    'oldest_pending_age_seconds',
      coalesce(max(EXTRACT(EPOCH FROM (now() - created_at)))::int, 0),
    'oldest_pending_event_id', (
      SELECT event_id FROM public.webhook_events
      WHERE status IN ('pending','processing')
      ORDER BY created_at ASC LIMIT 1
    ),
    'stalled_over_10m',
      count(*) FILTER (WHERE created_at < now() - interval '10 minutes')
  )
  INTO ages
  FROM public.webhook_events
  WHERE status IN ('pending','processing');

  SELECT to_jsonb(h) INTO health
  FROM public.webhook_worker_health h
  WHERE h.worker = 'process-webhook-events';

  SELECT jsonb_build_object(
    'pending',       count(*) FILTER (WHERE status = 'pending'),
    'processing',    count(*) FILTER (WHERE status = 'processing'),
    'parked',        count(*) FILTER (WHERE status = 'failed'),
    'processed_24h', count(*) FILTER (WHERE status = 'processed' AND processed_at > now() - interval '24 hours'),
    'has_work',      public.webhook_events_has_work(),
    'cron_armed',    EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'process-webhook-events'),
    'ack_latency',   latency,
    'recent',        recent,
    'worker_health', health,
    'pending_age',   ages
  )
  INTO result
  FROM public.webhook_events;

  RETURN result;
END;
$function$;
