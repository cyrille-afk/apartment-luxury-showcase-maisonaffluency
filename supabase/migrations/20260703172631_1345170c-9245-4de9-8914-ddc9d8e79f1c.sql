ALTER TABLE public.trade_applications
  ADD COLUMN IF NOT EXISTS edit_token_hash TEXT;

DROP INDEX IF EXISTS public.trade_applications_edit_token_key;

ALTER TABLE public.trade_applications
  DROP COLUMN IF EXISTS edit_token;

CREATE UNIQUE INDEX IF NOT EXISTS trade_applications_edit_token_hash_key
  ON public.trade_applications (edit_token_hash)
  WHERE edit_token_hash IS NOT NULL;