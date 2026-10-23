CREATE TABLE public.mobile_sync_tokens (
  token_hash text PRIMARY KEY,
  user_id uuid NOT NULL,
  expires_at timestamptz NOT NULL,
  used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.mobile_sync_tokens TO service_role;
REVOKE ALL ON public.mobile_sync_tokens FROM anon, authenticated;
ALTER TABLE public.mobile_sync_tokens ENABLE ROW LEVEL SECURITY;
CREATE INDEX mobile_sync_tokens_user_idx ON public.mobile_sync_tokens(user_id, created_at DESC);