-- Read-only queue observability for admins (and the E2E suite).
-- Exposes queue depth plus whether the self-disarming retry cron is currently
-- armed, without handing anyone the service-role key or cron table access.
CREATE OR REPLACE FUNCTION public.webhook_queue_status()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result jsonb;
BEGIN
  IF NOT (public.has_role(auth.uid(), 'admin'::app_role)
          OR public.has_role(auth.uid(), 'super_admin'::app_role)) THEN
    RAISE EXCEPTION 'not authorised';
  END IF;

  SELECT jsonb_build_object(
    'pending',    count(*) FILTER (WHERE status = 'pending'),
    'processing', count(*) FILTER (WHERE status = 'processing'),
    'processed',  count(*) FILTER (WHERE status = 'processed'),
    'failed',     count(*) FILTER (WHERE status = 'failed'),
    'has_work',   public.webhook_events_has_work(),
    'cron_armed', EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'process-webhook-events')
  )
  INTO result
  FROM public.webhook_events;

  RETURN result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.webhook_queue_status() TO authenticated;
GRANT EXECUTE ON FUNCTION public.webhook_queue_status() TO service_role;