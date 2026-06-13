ALTER TABLE public.trade_quotes
  ADD COLUMN IF NOT EXISTS managed_freight_quote_id uuid
    REFERENCES public.shipping_quotes(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_trade_quotes_managed_freight
  ON public.trade_quotes(managed_freight_quote_id);