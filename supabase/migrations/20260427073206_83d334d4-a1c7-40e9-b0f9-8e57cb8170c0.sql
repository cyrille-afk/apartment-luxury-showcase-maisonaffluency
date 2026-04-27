ALTER TABLE public.trade_quotes
  ADD COLUMN IF NOT EXISTS insurance_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS insurance_tier text NOT NULL DEFAULT 'standard',
  ADD COLUMN IF NOT EXISTS insurance_rate_bps smallint NOT NULL DEFAULT 50,
  ADD COLUMN IF NOT EXISTS insurance_notes text;

ALTER TABLE public.trade_quotes
  DROP CONSTRAINT IF EXISTS trade_quotes_insurance_tier_check;
ALTER TABLE public.trade_quotes
  ADD CONSTRAINT trade_quotes_insurance_tier_check
  CHECK (insurance_tier IN ('standard','premium','all_risk'));