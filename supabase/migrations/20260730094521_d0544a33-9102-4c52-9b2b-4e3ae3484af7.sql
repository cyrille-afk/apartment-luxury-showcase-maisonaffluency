-- 1. Profile tier columns: admin-only
CREATE OR REPLACE FUNCTION public.tg_guard_profile_tier_columns()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _uid uuid := auth.uid();
  _changed jsonb := '[]'::jsonb;
BEGIN
  -- Service-role / backend contexts (no JWT) and admins are unrestricted.
  IF _uid IS NULL
     OR public.has_role(_uid, 'admin'::app_role)
     OR public.has_role(_uid, 'super_admin'::app_role) THEN
    RETURN NEW;
  END IF;

  IF NEW.trade_tier IS DISTINCT FROM OLD.trade_tier THEN
    _changed := _changed || jsonb_build_object('column','trade_tier','attempted',NEW.trade_tier,'reverted_to',OLD.trade_tier);
    NEW.trade_tier := OLD.trade_tier;
  END IF;
  IF NEW.trade_tier_suggested IS DISTINCT FROM OLD.trade_tier_suggested THEN
    _changed := _changed || jsonb_build_object('column','trade_tier_suggested','attempted',NEW.trade_tier_suggested,'reverted_to',OLD.trade_tier_suggested);
    NEW.trade_tier_suggested := OLD.trade_tier_suggested;
  END IF;
  IF NEW.trade_tier_locked_by_admin IS DISTINCT FROM OLD.trade_tier_locked_by_admin THEN
    _changed := _changed || jsonb_build_object('column','trade_tier_locked_by_admin','attempted',NEW.trade_tier_locked_by_admin,'reverted_to',OLD.trade_tier_locked_by_admin);
    NEW.trade_tier_locked_by_admin := OLD.trade_tier_locked_by_admin;
  END IF;
  IF NEW.trade_tier_12mo_spend_cents IS DISTINCT FROM OLD.trade_tier_12mo_spend_cents THEN
    _changed := _changed || jsonb_build_object('column','trade_tier_12mo_spend_cents','attempted',NEW.trade_tier_12mo_spend_cents,'reverted_to',OLD.trade_tier_12mo_spend_cents);
    NEW.trade_tier_12mo_spend_cents := OLD.trade_tier_12mo_spend_cents;
  END IF;
  IF NEW.trade_tier_computed_at IS DISTINCT FROM OLD.trade_tier_computed_at THEN
    NEW.trade_tier_computed_at := OLD.trade_tier_computed_at;
  END IF;

  IF jsonb_array_length(_changed) > 0 THEN
    PERFORM public.record_security_event(
      'pricing_tamper_attempt', 'profiles', _uid, NULL,
      jsonb_build_object('table_name','profiles','columns',_changed)
    );
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS guard_profile_tier_columns ON public.profiles;
CREATE TRIGGER guard_profile_tier_columns
BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.tg_guard_profile_tier_columns();

-- 2. Quote-level pricing fields
CREATE OR REPLACE FUNCTION public.tg_guard_quote_pricing()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _uid uuid := auth.uid();
  _tier text;
  _tier_pct numeric;
  _credits bigint;
  _changed jsonb := '[]'::jsonb;
BEGIN
  IF _uid IS NULL
     OR public.has_role(_uid, 'admin'::app_role)
     OR public.has_role(_uid, 'super_admin'::app_role) THEN
    RETURN NEW;
  END IF;

  SELECT COALESCE(p.trade_tier, 'silver') INTO _tier
  FROM public.profiles p WHERE p.id = NEW.user_id;
  SELECT c.discount_pct INTO _tier_pct
  FROM public.trade_tier_config c WHERE c.tier = COALESCE(_tier, 'silver');
  _tier_pct := COALESCE(_tier_pct, 0.08);

  -- Commission / net discount may only ever equal the account's own tier rate.
  IF NEW.commission_pct IS NOT NULL AND NEW.commission_pct::numeric <> _tier_pct THEN
    _changed := _changed || jsonb_build_object('column','commission_pct','attempted',NEW.commission_pct,'reverted_to',_tier_pct);
    NEW.commission_pct := _tier_pct;
  END IF;
  IF NEW.net_discount_pct IS NOT NULL AND NEW.net_discount_pct::numeric <> _tier_pct THEN
    _changed := _changed || jsonb_build_object('column','net_discount_pct','attempted',NEW.net_discount_pct,'reverted_to',_tier_pct);
    NEW.net_discount_pct := _tier_pct;
  END IF;

  -- Applied credit must match credits actually issued & applied to this quote.
  SELECT COALESCE(SUM(tc.amount_cents), 0) INTO _credits
  FROM public.trade_credits tc
  WHERE tc.applied_to_quote_id = NEW.id AND tc.status = 'applied';

  IF COALESCE(NEW.credit_applied_cents, 0) <> _credits THEN
    _changed := _changed || jsonb_build_object('column','credit_applied_cents','attempted',NEW.credit_applied_cents,'reverted_to',_credits);
    NEW.credit_applied_cents := NULLIF(_credits, 0);
  END IF;

  IF jsonb_array_length(_changed) > 0 THEN
    PERFORM public.record_security_event(
      'pricing_tamper_attempt', 'trade_quotes', _uid, NULL,
      jsonb_build_object('table_name','trade_quotes','quote_id',NEW.id,'columns',_changed)
    );
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS guard_quote_pricing ON public.trade_quotes;
CREATE TRIGGER guard_quote_pricing
BEFORE INSERT OR UPDATE ON public.trade_quotes
FOR EACH ROW EXECUTE FUNCTION public.tg_guard_quote_pricing();

-- 3. Quote line-item pricing fields
CREATE OR REPLACE FUNCTION public.tg_guard_quote_item_pricing()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _uid uuid := auth.uid();
  _catalog bigint;
  _catalog_ccy text;
  _fabric_price bigint;
  _expected_upcharge bigint;
  _changed jsonb := '[]'::jsonb;
BEGIN
  IF _uid IS NULL
     OR public.has_role(_uid, 'admin'::app_role)
     OR public.has_role(_uid, 'super_admin'::app_role) THEN
    RETURN NEW;
  END IF;

  -- Manual unit price may be raised but never dropped below the catalogue price
  -- (comparison only when the line currency matches the catalogue currency).
  IF NEW.unit_price_cents IS NOT NULL AND NEW.product_id IS NOT NULL THEN
    SELECT COALESCE(tp.trade_price_cents, tp.rrp_price_cents), tp.currency
      INTO _catalog, _catalog_ccy
    FROM public.trade_products tp WHERE tp.id = NEW.product_id;

    IF _catalog IS NOT NULL
       AND COALESCE(NEW.unit_price_currency, _catalog_ccy) = COALESCE(_catalog_ccy, NEW.unit_price_currency)
       AND NEW.unit_price_cents < _catalog THEN
      _changed := _changed || jsonb_build_object('column','unit_price_cents','attempted',NEW.unit_price_cents,'reverted_to',_catalog);
      NEW.unit_price_cents := _catalog;
    END IF;
  END IF;

  -- Fabric upcharge must equal fabric price/lm x metres.
  IF NEW.fabric_id IS NULL OR NEW.fabric_meters IS NULL OR NEW.fabric_meters <= 0 THEN
    _expected_upcharge := NULL;
  ELSE
    SELECT f.price_per_lm_cents INTO _fabric_price FROM public.fabrics f WHERE f.id = NEW.fabric_id;
    _expected_upcharge := NULLIF(ROUND(COALESCE(_fabric_price, 0) * NEW.fabric_meters), 0);
  END IF;

  IF COALESCE(NEW.fabric_upcharge_cents, -1) IS DISTINCT FROM COALESCE(_expected_upcharge, -1) THEN
    _changed := _changed || jsonb_build_object('column','fabric_upcharge_cents','attempted',NEW.fabric_upcharge_cents,'reverted_to',_expected_upcharge);
    NEW.fabric_upcharge_cents := _expected_upcharge;
  END IF;

  -- Deposit percentage cannot be pushed below the standard 60%.
  IF NEW.deposit_pct_override IS NOT NULL
     AND (NEW.deposit_pct_override < 0.6 OR NEW.deposit_pct_override > 1) THEN
    _changed := _changed || jsonb_build_object('column','deposit_pct_override','attempted',NEW.deposit_pct_override,'reverted_to',LEAST(GREATEST(NEW.deposit_pct_override, 0.6), 1));
    NEW.deposit_pct_override := LEAST(GREATEST(NEW.deposit_pct_override, 0.6), 1);
  END IF;

  IF jsonb_array_length(_changed) > 0 THEN
    PERFORM public.record_security_event(
      'pricing_tamper_attempt', 'trade_quote_items', _uid, NULL,
      jsonb_build_object('table_name','trade_quote_items','item_id',NEW.id,'columns',_changed)
    );
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS guard_quote_item_pricing ON public.trade_quote_items;
CREATE TRIGGER guard_quote_item_pricing
BEFORE INSERT OR UPDATE ON public.trade_quote_items
FOR EACH ROW EXECUTE FUNCTION public.tg_guard_quote_item_pricing();