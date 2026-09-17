ALTER TABLE public.trade_quote_items
  ADD COLUMN IF NOT EXISTS fabrication_start_date DATE,
  ADD COLUMN IF NOT EXISTS expected_ready_override DATE;

CREATE INDEX IF NOT EXISTS trade_quote_items_expected_ready_override_idx
  ON public.trade_quote_items (expected_ready_override);