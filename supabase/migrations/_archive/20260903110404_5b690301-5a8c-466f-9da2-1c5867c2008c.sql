-- lovable-cron-fallback-reviewed: 96 runs/day; retry of failed AI verifications must happen ~15 min after failure; no event source exists for a timeout, so a low-frequency sweeper is the backstop.
ALTER TYPE public.trade_application_status ADD VALUE IF NOT EXISTS 'flagged_for_review';
ALTER TYPE public.trade_application_status ADD VALUE IF NOT EXISTS 'system_retry';

ALTER TABLE public.trade_applications
  ADD COLUMN IF NOT EXISTS verification_attempts integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS next_retry_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_verification_error text;

CREATE TABLE IF NOT EXISTS public.verification_feedback_loops (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id uuid REFERENCES public.trade_applications(id) ON DELETE SET NULL,
  submission jsonb NOT NULL DEFAULT '{}'::jsonb,
  ai_reasoning text,
  ai_confidence numeric,
  admin_decision text NOT NULL,
  admin_notes text,
  decided_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.verification_feedback_loops TO authenticated;
GRANT ALL ON public.verification_feedback_loops TO service_role;

ALTER TABLE public.verification_feedback_loops ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage verification feedback"
  ON public.verification_feedback_loops FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_verification_feedback_loops_updated_at
  BEFORE UPDATE ON public.verification_feedback_loops
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX IF NOT EXISTS idx_verification_feedback_created
  ON public.verification_feedback_loops (created_at DESC);

SELECT cron.unschedule('retry-trade-verification-15m')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'retry-trade-verification-15m');

SELECT cron.schedule(
  'retry-trade-verification-15m',
  '*/15 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://dcrauiygaezoduwdjmsm.supabase.co/functions/v1/cron-retry-trade-verification',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'CRON_SECRET' LIMIT 1)
    ),
    body := '{}'::jsonb
  );
  $$
);