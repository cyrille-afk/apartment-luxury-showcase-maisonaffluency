ALTER TABLE public.trade_quotes
  ADD COLUMN IF NOT EXISTS landed_cost_cbm numeric,
  ADD COLUMN IF NOT EXISTS landed_cost_kg numeric,
  ADD COLUMN IF NOT EXISTS landed_cost_mode text NOT NULL DEFAULT 'road';

ALTER TABLE public.trade_quotes
  DROP CONSTRAINT IF EXISTS trade_quotes_landed_cost_mode_check;

ALTER TABLE public.trade_quotes
  ADD CONSTRAINT trade_quotes_landed_cost_mode_check
  CHECK (landed_cost_mode IN ('road', 'courier'));

COMMENT ON COLUMN public.trade_quotes.landed_cost_cbm IS 'Saved declared volume for landed-cost estimates.';
COMMENT ON COLUMN public.trade_quotes.landed_cost_kg IS 'Saved declared or chargeable weight for landed-cost estimates.';
COMMENT ON COLUMN public.trade_quotes.landed_cost_mode IS 'Saved landed-cost freight mode.';