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
  _gold_min := COALESCE(_gold_min, 5000000);
  _plat_min := COALESCE(_plat_min, 20000000);

  WITH spend AS (
    SELECT tq.user_id,
           COALESCE(SUM(qi.quantity * COALESCE(qi.unit_price_cents, 0)), 0)::bigint AS cents
    FROM public.trade_quotes tq
    LEFT JOIN public.trade_quote_items qi ON qi.quote_id = tq.id
    WHERE tq.status = 'paid'
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

GRANT EXECUTE ON FUNCTION public.recompute_trade_tier_suggestions() TO authenticated, service_role;