-- lovable-cron-fallback-reviewed: 5760 runs/day; re-arms the existing self-disarming 15s queue timer only while a force-retried job is pending, and it unschedules itself on drain
CREATE OR REPLACE FUNCTION public.admin_queue_overview()
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  result jsonb;
BEGIN
  IF NOT (public.has_role(auth.uid(), 'admin'::app_role)
          OR public.has_role(auth.uid(), 'super_admin'::app_role)) THEN
    RAISE EXCEPTION 'not authorised';
  END IF;

  SELECT jsonb_build_object(
    'pending',       count(*) FILTER (WHERE status = 'pending'),
    'processing',    count(*) FILTER (WHERE status = 'processing'),
    'parked',        count(*) FILTER (WHERE status = 'failed'),
    'processed_24h', count(*) FILTER (WHERE status = 'processed' AND processed_at > now() - interval '24 hours'),
    'has_work',      public.webhook_events_has_work(),
    'cron_armed',    EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'process-webhook-events')
  )
  INTO result
  FROM public.webhook_events;

  RETURN result;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_requeue_webhook_event(p_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  updated public.webhook_events%ROWTYPE;
BEGIN
  IF NOT (public.has_role(auth.uid(), 'admin'::app_role)
          OR public.has_role(auth.uid(), 'super_admin'::app_role)) THEN
    RAISE EXCEPTION 'not authorised';
  END IF;

  UPDATE public.webhook_events
     SET status = 'pending',
         attempts = 0,
         locked_at = NULL,
         next_attempt_at = now(),
         updated_at = now()
   WHERE id = p_id
   RETURNING * INTO updated;

  IF updated.id IS NULL THEN
    RAISE EXCEPTION 'queue job not found';
  END IF;

  -- Re-arm the existing self-disarming safety timer, then kick the worker now.
  PERFORM pg_catalog.pg_advisory_xact_lock(7700000000000002);
  IF NOT EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'process-webhook-events') THEN
    BEGIN
      PERFORM cron.schedule('process-webhook-events', '15 seconds', $cron$ SELECT public.webhook_queue_dispatch(); $cron$);
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
  END IF;

  BEGIN
    PERFORM public.webhook_queue_dispatch();
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  RETURN jsonb_build_object('id', updated.id, 'status', updated.status, 'attempts', updated.attempts);
END;
$$;

REVOKE ALL ON FUNCTION public.admin_queue_overview() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_requeue_webhook_event(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_queue_overview() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.admin_requeue_webhook_event(uuid) TO authenticated, service_role;