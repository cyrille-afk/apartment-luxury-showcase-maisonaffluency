ALTER TABLE public.trade_quote_items
  ADD COLUMN IF NOT EXISTS crating_cents integer,
  ADD COLUMN IF NOT EXISTS crating_currency text;