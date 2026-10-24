CREATE OR REPLACE FUNCTION public.tg_guard_quote_pricing()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
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

  SELECT COALESCE(p.trade_tier::text, 'silver') INTO _tier
  FROM public.profiles p WHERE p.id = NEW.user_id;
  SELECT c.discount_pct INTO _tier_pct
  FROM public.trade_tier_config c WHERE c.tier::text = COALESCE(_tier, 'silver');
  _tier_pct := COALESCE(_tier_pct, 0.08);

  IF NEW.commission_pct IS NOT NULL AND NEW.commission_pct::numeric <> _tier_pct THEN
    _changed := _changed || jsonb_build_object('column','commission_pct','attempted',NEW.commission_pct,'reverted_to',_tier_pct);
    NEW.commission_pct := _tier_pct;
  END IF;
  IF NEW.net_discount_pct IS NOT NULL AND NEW.net_discount_pct::numeric <> _tier_pct THEN
    _changed := _changed || jsonb_build_object('column','net_discount_pct','attempted',NEW.net_discount_pct,'reverted_to',_tier_pct);
    NEW.net_discount_pct := _tier_pct;
  END IF;

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
$function$;