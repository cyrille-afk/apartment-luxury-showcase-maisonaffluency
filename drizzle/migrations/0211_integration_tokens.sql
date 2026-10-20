CREATE TABLE public.integration_tokens (
  provider text PRIMARY KEY,
  access_token text NOT NULL,
  expires_at timestamptz,
  account_label text,
  updated_by uuid,
  updated_at timestamptz NOT NULL DEFAULT now()
);
REVOKE ALL ON public.integration_tokens FROM anon, authenticated;
GRANT ALL ON public.integration_tokens TO service_role;
ALTER TABLE public.integration_tokens ENABLE ROW LEVEL SECURITY;