ALTER TABLE public.trade_quote_extras ADD COLUMN IF NOT EXISTS currency text;
UPDATE public.trade_quote_extras e
SET currency = q.currency
FROM public.trade_quotes q
WHERE e.quote_id = q.id AND (e.currency IS NULL OR e.currency = '');