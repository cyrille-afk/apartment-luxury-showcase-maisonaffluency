
-- ============================================================
-- #5 Stock & lead-time
-- ============================================================
CREATE TABLE IF NOT EXISTS public.brand_lead_times (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_name text NOT NULL UNIQUE,
  default_lead_weeks_min smallint,
  default_lead_weeks_max smallint,
  default_stock_status text NOT NULL DEFAULT 'made_to_order',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.brand_lead_times ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins manage brand lead times" ON public.brand_lead_times;
CREATE POLICY "Admins manage brand lead times"
  ON public.brand_lead_times FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Trade users view brand lead times" ON public.brand_lead_times;
CREATE POLICY "Trade users view brand lead times"
  ON public.brand_lead_times FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'trade_user'::app_role) OR public.has_role(auth.uid(), 'admin'::app_role));

DROP TRIGGER IF EXISTS trg_brand_lead_times_updated_at ON public.brand_lead_times;
CREATE TRIGGER trg_brand_lead_times_updated_at
  BEFORE UPDATE ON public.brand_lead_times
  FOR EACH ROW EXECUTE FUNCTION public.tms_set_updated_at();

ALTER TABLE public.trade_products
  ADD COLUMN IF NOT EXISTS lead_weeks_min_override smallint,
  ADD COLUMN IF NOT EXISTS lead_weeks_max_override smallint,
  ADD COLUMN IF NOT EXISTS stock_status_override text;

CREATE OR REPLACE FUNCTION public.effective_product_availability(_product_id uuid)
RETURNS TABLE (
  lead_weeks_min smallint,
  lead_weeks_max smallint,
  stock_status text,
  source text
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT
    COALESCE(tp.lead_weeks_min_override, blt.default_lead_weeks_min),
    COALESCE(tp.lead_weeks_max_override, blt.default_lead_weeks_max),
    COALESCE(tp.stock_status_override, blt.default_stock_status, 'made_to_order'),
    CASE
      WHEN tp.lead_weeks_min_override IS NOT NULL OR tp.stock_status_override IS NOT NULL THEN 'product'
      WHEN blt.brand_name IS NOT NULL THEN 'brand'
      ELSE 'default'
    END
  FROM public.trade_products tp
  LEFT JOIN public.brand_lead_times blt ON blt.brand_name = tp.brand_name
  WHERE tp.id = _product_id;
$$;

REVOKE EXECUTE ON FUNCTION public.effective_product_availability(uuid) FROM anon, public;
GRANT  EXECUTE ON FUNCTION public.effective_product_availability(uuid) TO authenticated;

-- ============================================================
-- #6 Tiered pricing — discount table + suggestion engine
-- ============================================================
CREATE OR REPLACE FUNCTION public.tier_discount_pct(_tier trade_tier)
RETURNS numeric
LANGUAGE sql IMMUTABLE SET search_path = public
AS $$
  SELECT CASE _tier
    WHEN 'platinum' THEN 0.18
    WHEN 'gold'     THEN 0.12
    WHEN 'silver'   THEN 0.08
    ELSE 0.08
  END;
$$;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS trade_tier_suggested public.trade_tier,
  ADD COLUMN IF NOT EXISTS trade_tier_locked_by_admin boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS trade_tier_12mo_spend_cents bigint NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS trade_tier_computed_at timestamptz;

CREATE OR REPLACE FUNCTION public.recompute_trade_tier_suggestions()
RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _updated integer := 0;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Only admins can recompute tier suggestions';
  END IF;

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
           WHEN COALESCE(s.cents,0) >= 25000000 THEN 'platinum'::trade_tier
           WHEN COALESCE(s.cents,0) >=  5000000 THEN 'gold'::trade_tier
           ELSE 'silver'::trade_tier
         END,
         trade_tier_computed_at = now()
    FROM (SELECT id FROM public.profiles) ids
    LEFT JOIN spend s ON s.user_id = ids.id
   WHERE p.id = ids.id;

  GET DIAGNOSTICS _updated = ROW_COUNT;
  RETURN _updated;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.recompute_trade_tier_suggestions() FROM anon, public;
GRANT  EXECUTE ON FUNCTION public.recompute_trade_tier_suggestions() TO authenticated;
