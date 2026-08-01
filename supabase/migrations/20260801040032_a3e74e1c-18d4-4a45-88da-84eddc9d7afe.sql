-- Extend profile guard to cover trade_status (trade approval gate)
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
  -- Service-role / backend contexts (no JWT), admins, and explicit
  -- server-side bypass (signup/verification flows) are unrestricted.
  IF _uid IS NULL
     OR COALESCE(current_setting('app.bypass_profile_guard', true), '') = 'on'
     OR public.has_role(_uid, 'admin'::app_role)
     OR public.has_role(_uid, 'super_admin'::app_role) THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    -- Never trust client-supplied privilege columns on self-insert.
    NEW.trade_tier := NULL;
    NEW.trade_tier_suggested := NULL;
    NEW.trade_tier_locked_by_admin := FALSE;
    NEW.trade_tier_12mo_spend_cents := NULL;
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

DROP TRIGGER IF EXISTS guard_profile_tier_columns_insert ON public.profiles;
CREATE TRIGGER guard_profile_tier_columns_insert
BEFORE INSERT ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.tg_guard_profile_tier_columns();

-- Signup/verification flow runs server-side and must be able to set trade_status
CREATE OR REPLACE FUNCTION public.handle_new_trade_signup()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
    user_email TEXT;
    email_domain TEXT;
    assigned_status TEXT;
BEGIN
    user_email := LOWER(NEW.email);
    email_domain := SUBSTRING(user_email FROM '@(.*)$');

    IF NEW.email_confirmed_at IS NULL THEN
        assigned_status := 'pending_review';
    ELSIF email_domain IN ('gmail.com','googlemail.com','yahoo.com','yahoo.co.uk','hotmail.com','outlook.com','icloud.com','me.com','aol.com','live.com','proton.me','protonmail.com') THEN
        assigned_status := 'pending_review';
    ELSE
        assigned_status := 'approved';
    END IF;

    PERFORM set_config('app.bypass_profile_guard', 'on', true);

    INSERT INTO public.profiles (id, email, trade_status)
    VALUES (NEW.id, user_email, assigned_status)
    ON CONFLICT (id) DO UPDATE
      SET email = EXCLUDED.email,
          trade_status = CASE
            WHEN public.profiles.trade_status = 'approved' THEN 'approved'
            ELSE EXCLUDED.trade_status
          END;

    PERFORM set_config('app.bypass_profile_guard', 'off', true);

    RETURN NEW;
END;
$function$;