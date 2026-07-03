ALTER TABLE public.trade_applications
  ADD COLUMN IF NOT EXISTS edit_token TEXT,
  ADD COLUMN IF NOT EXISTS edit_token_expires_at TIMESTAMPTZ;

CREATE UNIQUE INDEX IF NOT EXISTS trade_applications_edit_token_key
  ON public.trade_applications (edit_token)
  WHERE edit_token IS NOT NULL;