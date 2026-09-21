ALTER TABLE public.trade_profiles
  ADD COLUMN IF NOT EXISTS approval_status text NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS tax_exempt_status boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS activated_from_lead_id uuid;