-- =========================================================================
-- Pre-flight operational lockdown: net-terms credit control, regional
-- compliance interception, catalogue scraping defence and allocation gating.
-- =========================================================================

-- 1. NET TERMS CREDIT CONTROL ---------------------------------------------
CREATE TABLE IF NOT EXISTS public.trade_credit_profiles (
  user_id uuid PRIMARY KEY,
  approved_credit_limit_eur_cents bigint NOT NULL DEFAULT 1000000,
  credit_currency text NOT NULL DEFAULT 'EUR',
  net_terms_enabled boolean NOT NULL DEFAULT true,
  settled_order_count integer NOT NULL DEFAULT 0,
  first_order_settled_at timestamptz,
  outstanding_balance_eur_cents bigint NOT NULL DEFAULT 0,
  first_order_limit_eur_cents bigint NOT NULL DEFAULT 500000,
  review_notes text,
  reviewed_by uuid,
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.trade_credit_profiles TO authenticated;
GRANT ALL ON public.trade_credit_profiles TO service_role;
ALTER TABLE public.trade_credit_profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Trade users read own credit profile" ON public.trade_credit_profiles;
CREATE POLICY "Trade users read own credit profile" ON public.trade_credit_profiles
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS "Admins manage credit profiles" ON public.trade_credit_profiles;
CREATE POLICY "Admins manage credit profiles" ON public.trade_credit_profiles
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE TRIGGER tg_trade_credit_profiles_updated_at
  BEFORE UPDATE ON public.trade_credit_profiles
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- Every newly approved trade account starts on the conservative default.
CREATE OR REPLACE FUNCTION public.tg_seed_trade_credit_profile()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'approved' AND NEW.user_id IS NOT NULL
     AND (TG_OP = 'INSERT' OR COALESCE(OLD.status::text, '') <> 'approved') THEN
    INSERT INTO public.trade_credit_profiles (user_id)
    VALUES (NEW.user_id)
    ON CONFLICT (user_id) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tg_seed_trade_credit_profile ON public.trade_applications;
CREATE TRIGGER tg_seed_trade_credit_profile
  AFTER INSERT OR UPDATE OF status ON public.trade_applications
  FOR EACH ROW EXECUTE FUNCTION public.tg_seed_trade_credit_profile();

-- Backfill existing approved accounts.
INSERT INTO public.trade_credit_profiles (user_id)
SELECT DISTINCT ta.user_id
FROM public.trade_applications ta
WHERE ta.status = 'approved' AND ta.user_id IS NOT NULL
ON CONFLICT (user_id) DO NOTHING;

-- 2. REGIONAL COMPLIANCE + CREDIT AUDIT ON ORDERS -------------------------
ALTER TABLE public.shop_orders
  ADD COLUMN IF NOT EXISTS compliance_review_status text,
  ADD COLUMN IF NOT EXISTS compliance_review_reason text,
  ADD COLUMN IF NOT EXISTS compliance_flagged_at timestamptz,
  ADD COLUMN IF NOT EXISTS buyer_registry_country text,
  ADD COLUMN IF NOT EXISTS credit_check_status text,
  ADD COLUMN IF NOT EXISTS credit_limit_eur_cents bigint,
  ADD COLUMN IF NOT EXISTS credit_exposure_eur_cents bigint;

CREATE INDEX IF NOT EXISTS idx_shop_orders_compliance_review
  ON public.shop_orders (compliance_review_status, created_at DESC)
  WHERE compliance_review_status IS NOT NULL;

-- 3. ANTI-SCRAPING ON WHOLESALE CATALOGUE ---------------------------------
CREATE TABLE IF NOT EXISTS public.trade_catalog_rate_limits (
  bucket_key text PRIMARY KEY,
  window_start timestamptz NOT NULL DEFAULT date_trunc('minute', now()),
  hits integer NOT NULL DEFAULT 0,
  flagged_at timestamptz
);
GRANT ALL ON public.trade_catalog_rate_limits TO service_role;
ALTER TABLE public.trade_catalog_rate_limits ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins read catalogue rate limits" ON public.trade_catalog_rate_limits;
CREATE POLICY "Admins read catalogue rate limits" ON public.trade_catalog_rate_limits
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));
GRANT SELECT ON public.trade_catalog_rate_limits TO authenticated;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS catalog_abuse_flagged_at timestamptz,
  ADD COLUMN IF NOT EXISTS catalog_abuse_strikes integer NOT NULL DEFAULT 0;

-- Fixed-window counter. Returns the decision plus remaining allowance so the
-- edge function can answer 429 without a second round trip.
CREATE OR REPLACE FUNCTION public.enforce_trade_catalog_rate_limit(
  _actor text,
  _endpoint text,
  _limit integer DEFAULT 90,
  _window_seconds integer DEFAULT 60
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  key text := _endpoint || ':' || COALESCE(NULLIF(_actor, ''), 'anonymous');
  bucket timestamptz := to_timestamp(floor(extract(epoch FROM now()) / GREATEST(_window_seconds, 1)) * GREATEST(_window_seconds, 1));
  current_hits integer;
  was_flagged timestamptz;
BEGIN
  INSERT INTO public.trade_catalog_rate_limits (bucket_key, window_start, hits)
  VALUES (key, bucket, 1)
  ON CONFLICT (bucket_key) DO UPDATE
    SET hits = CASE WHEN public.trade_catalog_rate_limits.window_start < bucket THEN 1
                    ELSE public.trade_catalog_rate_limits.hits + 1 END,
        window_start = GREATEST(public.trade_catalog_rate_limits.window_start, bucket)
  RETURNING hits, flagged_at INTO current_hits, was_flagged;

  IF current_hits > _limit THEN
    UPDATE public.trade_catalog_rate_limits SET flagged_at = now() WHERE bucket_key = key;
    RETURN jsonb_build_object(
      'allowed', false,
      'hits', current_hits,
      'limit', _limit,
      'retry_after_seconds', GREATEST(_window_seconds, 1),
      'flagged', true
    );
  END IF;

  RETURN jsonb_build_object(
    'allowed', true,
    'hits', current_hits,
    'limit', _limit,
    'remaining', GREATEST(_limit - current_hits, 0),
    'flagged', was_flagged IS NOT NULL
  );
END;
$$;

REVOKE ALL ON FUNCTION public.enforce_trade_catalog_rate_limit(text, text, integer, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.enforce_trade_catalog_rate_limit(text, text, integer, integer) TO service_role;

-- 4. ALLOCATION SAFETY GATE -----------------------------------------------
ALTER TABLE public.trade_products
  ADD COLUMN IF NOT EXISTS is_allocation_restricted boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS allocation_unit_cap integer NOT NULL DEFAULT 3,
  ADD COLUMN IF NOT EXISTS available_stock_units integer;

ALTER TABLE public.designer_curator_picks
  ADD COLUMN IF NOT EXISTS is_allocation_restricted boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS allocation_unit_cap integer NOT NULL DEFAULT 3,
  ADD COLUMN IF NOT EXISTS available_stock_units integer;

CREATE OR REPLACE VIEW public.trade_products_public_rrp WITH (security_invoker=off) AS
 SELECT t.id,
    t.source_pick_id,
    t.rrp_price_cents,
    t.currency,
    t.price_unit,
    t.price_prefix,
    p.size_variants AS rrp_size_variants,
    COALESCE(t.is_allocation_restricted, p.is_allocation_restricted, false) AS is_allocation_restricted,
    COALESCE(NULLIF(t.allocation_unit_cap, 0), NULLIF(p.allocation_unit_cap, 0), 3) AS allocation_unit_cap,
    COALESCE(t.available_stock_units, p.available_stock_units) AS available_stock_units
   FROM (public.trade_products t
     LEFT JOIN public.designer_curator_picks p ON ((p.id = t.source_pick_id)))
  WHERE (t.is_active AND t.public_rrp_visible AND (COALESCE(t.rrp_price_cents, 0) > 0));

CREATE TABLE IF NOT EXISTS public.allocation_inquiries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  email text NOT NULL,
  full_name text,
  company text,
  phone text,
  pick_id uuid,
  product_title text NOT NULL,
  designer_name text,
  requested_quantity integer NOT NULL,
  allocation_cap integer,
  finish_label text,
  destination_country text,
  intended_use text,
  message text,
  status text NOT NULL DEFAULT 'pending',
  handled_by uuid,
  handled_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.allocation_inquiries TO authenticated;
GRANT UPDATE ON public.allocation_inquiries TO authenticated;
GRANT ALL ON public.allocation_inquiries TO service_role;
ALTER TABLE public.allocation_inquiries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users submit allocation inquiries" ON public.allocation_inquiries;
CREATE POLICY "Users submit allocation inquiries" ON public.allocation_inquiries
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Users read own allocation inquiries" ON public.allocation_inquiries;
CREATE POLICY "Users read own allocation inquiries" ON public.allocation_inquiries
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS "Admins manage allocation inquiries" ON public.allocation_inquiries;
CREATE POLICY "Admins manage allocation inquiries" ON public.allocation_inquiries
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE TRIGGER tg_allocation_inquiries_updated_at
  BEFORE UPDATE ON public.allocation_inquiries
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

CREATE INDEX IF NOT EXISTS idx_allocation_inquiries_status
  ON public.allocation_inquiries (status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_allocation_inquiries_user
  ON public.allocation_inquiries (user_id, created_at DESC);
