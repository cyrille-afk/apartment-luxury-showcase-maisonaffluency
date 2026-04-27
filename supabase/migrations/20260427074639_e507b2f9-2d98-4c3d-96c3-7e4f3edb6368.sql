-- Trade tier configuration table (single row per tier)
CREATE TABLE public.trade_tier_config (
  tier public.trade_tier PRIMARY KEY,
  discount_pct numeric NOT NULL,
  min_spend_cents bigint NOT NULL DEFAULT 0,
  label text NOT NULL,
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_by uuid
);

ALTER TABLE public.trade_tier_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage tier config"
  ON public.trade_tier_config
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Trade users view tier config"
  ON public.trade_tier_config
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'trade_user'::app_role) OR public.has_role(auth.uid(), 'admin'::app_role));

-- Seed with the new values: Silver 8% / Gold 10% / Platinum 15%
-- Thresholds: Silver $0–250k, Gold $250k–750k, Platinum $750k+
INSERT INTO public.trade_tier_config (tier, discount_pct, min_spend_cents, label) VALUES
  ('silver',   0.08, 0,             'Silver'),
  ('gold',     0.10, 25000000000,   'Gold'),      -- 250,000.00 (in cents = 25,000,000,000? no: 250,000 * 100 = 25,000,000)
  ('platinum', 0.15, 75000000000,   'Platinum');  -- 750,000 * 100 = 75,000,000

-- Fix seeded values (cents = units * 100)
UPDATE public.trade_tier_config SET min_spend_cents = 0 WHERE tier = 'silver';
UPDATE public.trade_tier_config SET min_spend_cents = 25000000 WHERE tier = 'gold';      -- 250,000.00
UPDATE public.trade_tier_config SET min_spend_cents = 75000000 WHERE tier = 'platinum';  -- 750,000.00

-- Update tier_discount_pct to read from the config table
CREATE OR REPLACE FUNCTION public.tier_discount_pct(_tier public.trade_tier)
RETURNS numeric
LANGUAGE sql
STABLE
SET search_path TO 'public'
AS $$
  SELECT COALESCE(
    (SELECT discount_pct FROM public.trade_tier_config WHERE tier = _tier),
    0.08
  );
$$;

-- Update auto-suggestion to read thresholds from the config table
CREATE OR REPLACE FUNCTION public.recompute_trade_tier_suggestions()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _updated integer := 0;
  _gold_min bigint;
  _plat_min bigint;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Only admins can recompute tier suggestions';
  END IF;

  SELECT min_spend_cents INTO _gold_min FROM public.trade_tier_config WHERE tier = 'gold';
  SELECT min_spend_cents INTO _plat_min FROM public.trade_tier_config WHERE tier = 'platinum';
  _gold_min := COALESCE(_gold_min, 25000000);
  _plat_min := COALESCE(_plat_min, 75000000);

  WITH spend AS (
    SELECT tq.user_id,
           COALESCE(SUM(qi.quantity * COALESCE(qi.unit_trade_price_cents, 0)), 0)::bigint AS cents
    FROM public.trade_quotes tq
    LEFT JOIN public.trade_quote_items qi ON qi.quote_id = tq.id
    WHERE tq.status IN ('confirmed','deposit_paid','paid')
      AND tq.updated_at >= now() - interval '365 days'
    GROUP BY tq.user_id
  )
  UPDATE public.profiles p
     SET trade_tier_12mo_spend_cents = COALESCE(s.cents, 0),
         trade_tier_suggested = CASE
           WHEN COALESCE(s.cents,0) >= _plat_min THEN 'platinum'::public.trade_tier
           WHEN COALESCE(s.cents,0) >= _gold_min THEN 'gold'::public.trade_tier
           ELSE 'silver'::public.trade_tier
         END,
         trade_tier_computed_at = now()
    FROM (SELECT id FROM public.profiles) ids
    LEFT JOIN spend s ON s.user_id = ids.id
   WHERE p.id = ids.id;

  GET DIAGNOSTICS _updated = ROW_COUNT;
  RETURN _updated;
END;
$$;