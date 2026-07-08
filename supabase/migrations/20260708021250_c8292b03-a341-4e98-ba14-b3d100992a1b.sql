-- Extend pricing/tier tamper-guards to also fire on INSERT.
-- On INSERT for non-admin, non-service-role callers, force protected columns
-- to safe defaults so a direct INSERT cannot escalate tier, discount,
-- commission, or unit price beyond what admin/service-role code sets.

-- 1) profiles: force trade_tier* to safe defaults on self-insert
CREATE OR REPLACE FUNCTION public.prevent_profile_tier_self_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF public.has_role(auth.uid(), 'admin'::app_role) OR auth.role() = 'service_role' THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    -- Ignore any client-supplied values for protected tier fields.
    NEW.trade_tier := NULL;
    NEW.trade_tier_locked_by_admin := FALSE;
    NEW.trade_tier_suggested := NULL;
    NEW.trade_tier_computed_at := NULL;
    RETURN NEW;
  END IF;

  IF NEW.trade_tier IS DISTINCT FROM OLD.trade_tier
     OR NEW.trade_tier_locked_by_admin IS DISTINCT FROM OLD.trade_tier_locked_by_admin
     OR NEW.trade_tier_suggested IS DISTINCT FROM OLD.trade_tier_suggested
     OR NEW.trade_tier_computed_at IS DISTINCT FROM OLD.trade_tier_computed_at THEN
    RAISE EXCEPTION 'Only admins can modify trade tier fields';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_profile_tier_self_insert ON public.profiles;
CREATE TRIGGER trg_prevent_profile_tier_self_insert
BEFORE INSERT ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.prevent_profile_tier_self_update();

-- 2) trade_quotes: force pricing/discount/commission fields to safe defaults on insert
CREATE OR REPLACE FUNCTION public.prevent_quote_pricing_self_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF public.has_role(auth.uid(), 'admin'::app_role) OR auth.role() = 'service_role' THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    NEW.net_discount_pct := 0;
    NEW.commission_pct := 0;
    NEW.credit_applied_cents := 0;
    NEW.insurance_rate_bps := 0;
    RETURN NEW;
  END IF;

  IF NEW.net_discount_pct IS DISTINCT FROM OLD.net_discount_pct
     OR NEW.commission_pct IS DISTINCT FROM OLD.commission_pct
     OR NEW.credit_applied_cents IS DISTINCT FROM OLD.credit_applied_cents
     OR NEW.insurance_rate_bps IS DISTINCT FROM OLD.insurance_rate_bps
     OR NEW.billing_mode IS DISTINCT FROM OLD.billing_mode THEN
    RAISE EXCEPTION 'Only admins can modify quote pricing/discount/commission fields';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_quote_pricing_self_insert ON public.trade_quotes;
CREATE TRIGGER trg_prevent_quote_pricing_self_insert
BEFORE INSERT ON public.trade_quotes
FOR EACH ROW EXECUTE FUNCTION public.prevent_quote_pricing_self_update();

-- 3) trade_quote_items: force unit price / fabric upcharge to NULL on insert
CREATE OR REPLACE FUNCTION public.prevent_quote_item_price_self_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF public.has_role(auth.uid(), 'admin'::app_role) OR auth.role() = 'service_role' THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    NEW.unit_price_cents := NULL;
    NEW.unit_price_currency := NULL;
    NEW.fabric_upcharge_cents := NULL;
    NEW.fabric_currency := NULL;
    RETURN NEW;
  END IF;

  IF NEW.unit_price_cents IS DISTINCT FROM OLD.unit_price_cents
     OR NEW.unit_price_currency IS DISTINCT FROM OLD.unit_price_currency
     OR NEW.fabric_upcharge_cents IS DISTINCT FROM OLD.fabric_upcharge_cents
     OR NEW.fabric_currency IS DISTINCT FROM OLD.fabric_currency THEN
    RAISE EXCEPTION 'Only admins can modify quote item pricing fields';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_quote_item_price_self_insert ON public.trade_quote_items;
CREATE TRIGGER trg_prevent_quote_item_price_self_insert
BEFORE INSERT ON public.trade_quote_items
FOR EACH ROW EXECUTE FUNCTION public.prevent_quote_item_price_self_update();