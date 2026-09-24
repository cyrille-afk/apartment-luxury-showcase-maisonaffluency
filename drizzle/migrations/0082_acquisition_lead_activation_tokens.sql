ALTER TABLE public.acquisition_leads
  ADD COLUMN IF NOT EXISTS activation_token_hash text,
  ADD COLUMN IF NOT EXISTS activation_token_expires_at timestamptz,
  ADD COLUMN IF NOT EXISTS activation_token_used_at timestamptz;
CREATE UNIQUE INDEX IF NOT EXISTS acquisition_leads_activation_token_hash_key
  ON public.acquisition_leads (activation_token_hash) WHERE activation_token_hash IS NOT NULL;