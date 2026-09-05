CREATE OR REPLACE FUNCTION public.prevent_profile_tier_self_update()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF COALESCE(current_setting('app.bypass_profile_guard', true), '') = 'on'
     OR auth.uid() IS NULL
     OR public.has_role(auth.uid(), 'admin'::app_role)
     OR public.has_role(auth.uid(), 'super_admin'::app_role)
     OR auth.role() = 'service_role' THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    -- Ignore any client-supplied values for protected tier fields.
    NEW.trade_tier := 'standard'::trade_tier;
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
$function$;

CREATE OR REPLACE FUNCTION public.tg_guard_profile_tier_columns()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _uid uuid := auth.uid();
  _changed jsonb := '[]'::jsonb;
BEGIN
  IF _uid IS NULL
     OR COALESCE(current_setting('app.bypass_profile_guard', true), '') = 'on'
     OR public.has_role(_uid, 'admin'::app_role)
     OR public.has_role(_uid, 'super_admin'::app_role) THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    NEW.trade_tier := 'standard'::trade_tier;
    NEW.trade_tier_suggested := NULL;
    NEW.trade_tier_locked_by_admin := FALSE;
    NEW.trade_tier_12mo_spend_cents := 0;
    NEW.trade_tier_computed_at := NULL;
    IF COALESCE(NEW.trade_status, 'pending_review') <> 'pending_review' THEN
      PERFORM public.record_security_event(
        'pricing_tamper_attempt', 'profiles', _uid, NULL,
        jsonb_build_object('table_name','profiles','columns',
          jsonb_build_array(jsonb_build_object('column','trade_status','attempted',NEW.trade_status)))
      );
      NEW.trade_status := 'pending_review';
    END IF;
    RETURN NEW;
  END IF;

  IF NEW.trade_tier IS DISTINCT FROM OLD.trade_tier THEN
    _changed := _changed || jsonb_build_object('column','trade_tier','attempted',NEW.trade_tier,'previous',OLD.trade_tier);
  END IF;
  IF NEW.trade_tier_suggested IS DISTINCT FROM OLD.trade_tier_suggested THEN
    _changed := _changed || jsonb_build_object('column','trade_tier_suggested','attempted',NEW.trade_tier_suggested,'previous',OLD.trade_tier_suggested);
  END IF;
  IF NEW.trade_tier_locked_by_admin IS DISTINCT FROM OLD.trade_tier_locked_by_admin THEN
    _changed := _changed || jsonb_build_object('column','trade_tier_locked_by_admin','attempted',NEW.trade_tier_locked_by_admin,'previous',OLD.trade_tier_locked_by_admin);
  END IF;
  IF NEW.trade_tier_12mo_spend_cents IS DISTINCT FROM OLD.trade_tier_12mo_spend_cents THEN
    _changed := _changed || jsonb_build_object('column','trade_tier_12mo_spend_cents','attempted',NEW.trade_tier_12mo_spend_cents,'previous',OLD.trade_tier_12mo_spend_cents);
  END IF;
  IF NEW.trade_tier_computed_at IS DISTINCT FROM OLD.trade_tier_computed_at THEN
    _changed := _changed || jsonb_build_object('column','trade_tier_computed_at','attempted',NEW.trade_tier_computed_at,'previous',OLD.trade_tier_computed_at);
  END IF;
  IF NEW.trade_status IS DISTINCT FROM OLD.trade_status THEN
    _changed := _changed || jsonb_build_object('column','trade_status','attempted',NEW.trade_status,'previous',OLD.trade_status);
  END IF;

  IF jsonb_array_length(_changed) > 0 THEN
    PERFORM public.record_security_event(
      'pricing_tamper_attempt', 'profiles', _uid, NULL,
      jsonb_build_object('table_name','profiles','columns',_changed)
    );
    RAISE EXCEPTION 'Trade tier and trade approval fields can only be modified by an administrator'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  RETURN NEW;
END;
$function$;