ALTER TABLE public.trade_quote_items
ADD COLUMN IF NOT EXISTS unit_price_currency text;

ALTER TABLE public.trade_quotes
ALTER COLUMN currency SET DEFAULT 'EUR';