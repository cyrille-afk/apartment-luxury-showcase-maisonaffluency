ALTER TABLE public.order_timeline
  ADD COLUMN IF NOT EXISTS commission_payout_currency text,
  ADD COLUMN IF NOT EXISTS commission_payout_cents bigint,
  ADD COLUMN IF NOT EXISTS commission_fx_rate numeric,
  ADD COLUMN IF NOT EXISTS commission_fx_source text,
  ADD COLUMN IF NOT EXISTS commission_fx_locked_at timestamptz;