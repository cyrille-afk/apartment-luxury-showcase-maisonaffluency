-- Server-side FX authority: cached rate table + locked quote rate

CREATE TABLE IF NOT EXISTS public.currency_rates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  base_currency TEXT NOT NULL,
  target_currency TEXT NOT NULL,
  rate NUMERIC(20, 10) NOT NULL CHECK (rate > 0),
  source TEXT NOT NULL DEFAULT 'unknown',
  rate_date DATE,
  last_updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT currency_rates_pair_unique UNIQUE (base_currency, target_currency)
);

GRANT SELECT ON public.currency_rates TO anon;
GRANT SELECT ON public.currency_rates TO authenticated;
GRANT ALL ON public.currency_rates TO service_role;

ALTER TABLE public.currency_rates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Currency rates are publicly readable"
ON public.currency_rates FOR SELECT
USING (true);

CREATE POLICY "Admins can manage currency rates"
ON public.currency_rates FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE INDEX IF NOT EXISTS idx_currency_rates_base ON public.currency_rates(base_currency);

-- Read helper: single authoritative lookup used by app + edge functions
CREATE OR REPLACE FUNCTION public.get_currency_rate(_base TEXT, _target TEXT)
RETURNS NUMERIC
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE
    WHEN upper(_base) = upper(_target) THEN 1::numeric
    ELSE (
      SELECT cr.rate FROM public.currency_rates cr
      WHERE cr.base_currency = upper(_base)
        AND cr.target_currency = upper(_target)
      LIMIT 1
    )
  END
$$;

GRANT EXECUTE ON FUNCTION public.get_currency_rate(TEXT, TEXT) TO anon, authenticated, service_role;

-- Locked rate stamped onto the quote row
ALTER TABLE public.trade_quotes
  ADD COLUMN IF NOT EXISTS exchange_rate_at_creation NUMERIC(20, 10),
  ADD COLUMN IF NOT EXISTS exchange_rate_locked_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS exchange_rate_base_currency TEXT;
