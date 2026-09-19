-- Asynchronous webhook event queue.
-- Stripe webhooks must answer within seconds; downstream work (emails,
-- WhatsApp, Slack, purchase-order PDFs) is queued here and drained by the
-- `process-webhook-events` worker so a slow notification can never time out
-- Stripe and trigger a retry storm (which previously duplicated POs).

CREATE TABLE IF NOT EXISTS public.webhook_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider TEXT NOT NULL DEFAULT 'stripe',
  -- Stripe's own event id: the idempotency anchor. A retried delivery hits
  -- this unique constraint and is acknowledged without re-running anything.
  event_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'pending',
  attempts INTEGER NOT NULL DEFAULT 0,
  max_attempts INTEGER NOT NULL DEFAULT 5,
  last_error TEXT,
  locked_at TIMESTAMPTZ,
  next_attempt_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  processed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS webhook_events_provider_event_id_key
  ON public.webhook_events (provider, event_id);

-- Drain path: pending rows that are due, oldest first.
CREATE INDEX IF NOT EXISTS idx_webhook_events_pending
  ON public.webhook_events (next_attempt_at)
  WHERE status IN ('pending', 'processing');

CREATE INDEX IF NOT EXISTS idx_webhook_events_status_created
  ON public.webhook_events (status, created_at DESC);

GRANT SELECT ON public.webhook_events TO authenticated;
GRANT ALL ON public.webhook_events TO service_role;

ALTER TABLE public.webhook_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can read webhook events"
  ON public.webhook_events
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'));

-- Atomically claim a batch. SKIP LOCKED means two concurrent workers never
-- pick the same event, so a duplicate purchase order is impossible.
CREATE OR REPLACE FUNCTION public.claim_webhook_events(batch_size INTEGER DEFAULT 5)
RETURNS SETOF public.webhook_events
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  WITH claimed AS (
    SELECT e.id
    FROM public.webhook_events e
    WHERE e.status IN ('pending', 'processing')
      AND e.next_attempt_at <= now()
      AND e.attempts < e.max_attempts
      -- a row stuck in 'processing' for 5 minutes is considered abandoned
      AND (e.status = 'pending' OR e.locked_at < now() - interval '5 minutes')
    ORDER BY e.created_at
    LIMIT GREATEST(1, LEAST(batch_size, 20))
    FOR UPDATE SKIP LOCKED
  )
  UPDATE public.webhook_events w
  SET status = 'processing',
      attempts = w.attempts + 1,
      locked_at = now(),
      updated_at = now()
  FROM claimed
  WHERE w.id = claimed.id
  RETURNING w.*;
END;
$$;

GRANT EXECUTE ON FUNCTION public.claim_webhook_events(INTEGER) TO service_role;

-- True while there is outstanding work; used to arm/disarm the retry cron.
CREATE OR REPLACE FUNCTION public.webhook_events_has_work()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.webhook_events
    WHERE status IN ('pending', 'processing')
      AND attempts < max_attempts
  );
$$;

GRANT EXECUTE ON FUNCTION public.webhook_events_has_work() TO service_role;