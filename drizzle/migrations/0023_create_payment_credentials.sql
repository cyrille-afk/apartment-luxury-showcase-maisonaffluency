CREATE TABLE IF NOT EXISTS public.payment_credentials (
  id text PRIMARY KEY DEFAULT 'live',
  live_publishable_key text,
  live_secret_key text,
  live_webhook_secret text,
  live_mode boolean NOT NULL DEFAULT false,
  updated_by uuid,
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Service role only: secrets are never readable by browser clients.
GRANT ALL ON public.payment_credentials TO service_role;

ALTER TABLE public.payment_credentials ENABLE ROW LEVEL SECURITY;
-- No policies: anon/authenticated have no access at all.