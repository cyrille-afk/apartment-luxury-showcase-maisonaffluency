ALTER TABLE public.acquisition_leads
  ADD COLUMN IF NOT EXISTS instagram_handle TEXT,
  ADD COLUMN IF NOT EXISTS executive_emails TEXT[] NOT NULL DEFAULT '{}'::text[];