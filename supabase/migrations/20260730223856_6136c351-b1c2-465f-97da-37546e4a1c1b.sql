
-- 1. trade_applications: no self-approval
CREATE OR REPLACE FUNCTION public.tg_guard_trade_application_status()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _changed jsonb := '[]'::jsonb;
BEGIN
  IF _uid IS NULL OR public.has_role(_uid, 'admin'::app_role) THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    IF NEW.status IS DISTINCT FROM 'pending'::trade_application_status THEN
      _changed := _changed || jsonb_build_object('column','status','attempted',NEW.status);
      NEW.status := 'pending'::trade_application_status;
    END IF;
    NEW.reviewed_at := NULL;
    NEW.reviewed_by := NULL;
  ELSE
    IF NEW.status IS DISTINCT FROM OLD.status THEN
      _changed := _changed || jsonb_build_object('column','status','attempted',NEW.status);
      NEW.status := OLD.status;
    END IF;
    NEW.reviewed_at := OLD.reviewed_at;
    NEW.reviewed_by := OLD.reviewed_by;
  END IF;

  IF jsonb_array_length(_changed) > 0 THEN
    PERFORM public.record_security_event(
      'privilege_escalation_attempt', 'trade_applications', _uid, NULL,
      jsonb_build_object('table_name','trade_applications','columns',_changed)
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS guard_trade_application_status ON public.trade_applications;
CREATE TRIGGER guard_trade_application_status
BEFORE INSERT OR UPDATE ON public.trade_applications
FOR EACH ROW EXECUTE FUNCTION public.tg_guard_trade_application_status();

-- 2. trade_quotes: status / confirmation / admin notes are admin-controlled
CREATE OR REPLACE FUNCTION public.tg_guard_quote_status()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _allowed text[] := ARRAY['draft','submitted','cancelled'];
  _changed jsonb := '[]'::jsonb;
BEGIN
  IF _uid IS NULL OR public.has_role(_uid, 'admin'::app_role) THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    IF COALESCE(NEW.status,'draft') <> 'draft' THEN
      _changed := _changed || jsonb_build_object('column','status','attempted',NEW.status);
      NEW.status := 'draft';
    END IF;
    NEW.confirmed_at := NULL;
    NEW.responded_at := NULL;
    NEW.admin_notes := NULL;
  ELSE
    IF NEW.status IS DISTINCT FROM OLD.status AND NOT (NEW.status = ANY(_allowed)) THEN
      _changed := _changed || jsonb_build_object('column','status','attempted',NEW.status);
      NEW.status := OLD.status;
    END IF;
    IF NEW.confirmed_at IS DISTINCT FROM OLD.confirmed_at THEN
      _changed := _changed || jsonb_build_object('column','confirmed_at','attempted',NEW.confirmed_at);
      NEW.confirmed_at := OLD.confirmed_at;
    END IF;
    IF NEW.responded_at IS DISTINCT FROM OLD.responded_at THEN
      NEW.responded_at := OLD.responded_at;
    END IF;
    IF NEW.admin_notes IS DISTINCT FROM OLD.admin_notes THEN
      _changed := _changed || jsonb_build_object('column','admin_notes','attempted',NEW.admin_notes);
      NEW.admin_notes := OLD.admin_notes;
    END IF;
  END IF;

  IF jsonb_array_length(_changed) > 0 THEN
    PERFORM public.record_security_event(
      'privilege_escalation_attempt', 'trade_quotes', _uid, NULL,
      jsonb_build_object('table_name','trade_quotes','quote_id',NEW.id,'columns',_changed)
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS guard_quote_status ON public.trade_quotes;
CREATE TRIGGER guard_quote_status
BEFORE INSERT OR UPDATE ON public.trade_quotes
FOR EACH ROW EXECUTE FUNCTION public.tg_guard_quote_status();

-- 3. trade_custom_requests: status / admin notes are admin-controlled
CREATE OR REPLACE FUNCTION public.tg_guard_custom_request_status()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _allowed text[] := ARRAY['new','cancelled'];
  _changed jsonb := '[]'::jsonb;
BEGIN
  IF _uid IS NULL OR public.has_role(_uid, 'admin'::app_role) THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    IF COALESCE(NEW.status,'new') <> 'new' THEN
      _changed := _changed || jsonb_build_object('column','status','attempted',NEW.status);
      NEW.status := 'new';
    END IF;
    NEW.admin_notes := NULL;
  ELSE
    IF NEW.status IS DISTINCT FROM OLD.status AND NOT (NEW.status = ANY(_allowed)) THEN
      _changed := _changed || jsonb_build_object('column','status','attempted',NEW.status);
      NEW.status := OLD.status;
    END IF;
    IF NEW.admin_notes IS DISTINCT FROM OLD.admin_notes THEN
      _changed := _changed || jsonb_build_object('column','admin_notes','attempted',NEW.admin_notes);
      NEW.admin_notes := OLD.admin_notes;
    END IF;
  END IF;

  IF jsonb_array_length(_changed) > 0 THEN
    PERFORM public.record_security_event(
      'privilege_escalation_attempt', 'trade_custom_requests', _uid, NULL,
      jsonb_build_object('table_name','trade_custom_requests','request_id',NEW.id,'columns',_changed)
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS guard_custom_request_status ON public.trade_custom_requests;
CREATE TRIGGER guard_custom_request_status
BEFORE INSERT OR UPDATE ON public.trade_custom_requests
FOR EACH ROW EXECUTE FUNCTION public.tg_guard_custom_request_status();

-- 4. axonometric_requests: fulfilment fields are admin-controlled
CREATE OR REPLACE FUNCTION public.tg_guard_axonometric_request_status()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _changed jsonb := '[]'::jsonb;
BEGIN
  IF _uid IS NULL OR public.has_role(_uid, 'admin'::app_role) THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    IF NEW.status IS DISTINCT FROM 'pending'::axonometric_request_status THEN
      _changed := _changed || jsonb_build_object('column','status','attempted',NEW.status);
      NEW.status := 'pending'::axonometric_request_status;
    END IF;
    NEW.result_image_url := NULL;
    NEW.admin_notes := NULL;
  ELSE
    IF NEW.status IS DISTINCT FROM OLD.status THEN
      _changed := _changed || jsonb_build_object('column','status','attempted',NEW.status);
      NEW.status := OLD.status;
    END IF;
    IF NEW.result_image_url IS DISTINCT FROM OLD.result_image_url THEN
      _changed := _changed || jsonb_build_object('column','result_image_url','attempted',NEW.result_image_url);
      NEW.result_image_url := OLD.result_image_url;
    END IF;
    IF NEW.admin_notes IS DISTINCT FROM OLD.admin_notes THEN
      _changed := _changed || jsonb_build_object('column','admin_notes','attempted',NEW.admin_notes);
      NEW.admin_notes := OLD.admin_notes;
    END IF;
  END IF;

  IF jsonb_array_length(_changed) > 0 THEN
    PERFORM public.record_security_event(
      'privilege_escalation_attempt', 'axonometric_requests', _uid, NULL,
      jsonb_build_object('table_name','axonometric_requests','request_id',NEW.id,'columns',_changed)
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS guard_axonometric_request_status ON public.axonometric_requests;
CREATE TRIGGER guard_axonometric_request_status
BEFORE INSERT OR UPDATE ON public.axonometric_requests
FOR EACH ROW EXECUTE FUNCTION public.tg_guard_axonometric_request_status();
