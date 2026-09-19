ALTER TABLE public.trade_quote_items
  ADD COLUMN IF NOT EXISTS po_number text,
  ADD COLUMN IF NOT EXISTS cost_code text,
  ADD COLUMN IF NOT EXISTS lead_time_weeks_override integer,
  ADD COLUMN IF NOT EXISTS deposit_pct_override numeric(5,4);

COMMENT ON COLUMN public.trade_quote_items.po_number IS 'Optional purchase order reference per quote line';
COMMENT ON COLUMN public.trade_quote_items.cost_code IS 'Optional internal cost / budget code per quote line';
COMMENT ON COLUMN public.trade_quote_items.lead_time_weeks_override IS 'Optional override of the default product lead time, in weeks';
COMMENT ON COLUMN public.trade_quote_items.deposit_pct_override IS 'Optional override of default deposit percent (0..1), e.g. 0.5 for 50%';