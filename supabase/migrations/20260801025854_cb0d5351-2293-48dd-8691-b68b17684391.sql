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
  -- Service-role / backend contexts (no JWT) and admins are unrestricted.
  IF _uid IS NULL
     OR public.has_role(_uid, 'admin'::app_role)
     OR public.has_role(_uid, 'super_admin'::app_role) THEN
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

  IF jsonb_array_length(_changed) > 0 THEN
    PERFORM public.record_security_event(
      'pricing_tamper_attempt', 'profiles', _uid, NULL,
      jsonb_build_object('table_name','profiles','columns',_changed)
    );
    RAISE EXCEPTION 'Trade tier fields can only be modified by an administrator'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS guard_profile_tier_columns ON public.profiles;
CREATE TRIGGER guard_profile_tier_columns
BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.tg_guard_profile_tier_columns();