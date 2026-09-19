
CREATE OR REPLACE FUNCTION public.upsert_admin_directory_client(
  p_studio_id uuid,
  p_created_by uuid,
  p_company text,
  p_first_name text,
  p_last_name text,
  p_email text,
  p_phone text,
  p_role_title text,
  p_notes text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_client_id uuid;
  v_name text;
  v_contact_id uuid;
BEGIN
  v_name := NULLIF(btrim(COALESCE(p_company, '')), '');
  IF v_name IS NULL THEN
    v_name := NULLIF(btrim(concat_ws(' ', p_first_name, p_last_name)), '');
  END IF;
  IF v_name IS NULL THEN
    v_name := COALESCE(p_email, 'Unknown');
  END IF;

  SELECT id INTO v_client_id
  FROM public.clients
  WHERE studio_id = p_studio_id AND lower(name) = lower(v_name)
  LIMIT 1;

  IF v_client_id IS NULL THEN
    INSERT INTO public.clients (studio_id, created_by, name, type, notes)
    VALUES (p_studio_id, p_created_by, v_name, 'company'::client_type, p_notes)
    RETURNING id INTO v_client_id;
  END IF;

  IF NULLIF(btrim(COALESCE(p_email, '')), '') IS NOT NULL THEN
    SELECT id INTO v_contact_id
    FROM public.client_contacts
    WHERE client_id = v_client_id AND lower(coalesce(email, '')) = lower(p_email)
    LIMIT 1;
  ELSE
    SELECT id INTO v_contact_id
    FROM public.client_contacts
    WHERE client_id = v_client_id
      AND lower(coalesce(first_name, '')) = lower(coalesce(p_first_name, ''))
      AND lower(coalesce(last_name, '')) = lower(coalesce(p_last_name, ''))
    LIMIT 1;
  END IF;

  IF v_contact_id IS NULL THEN
    INSERT INTO public.client_contacts (
      client_id, first_name, last_name, role_title, email, phone, is_primary
    ) VALUES (
      v_client_id,
      COALESCE(p_first_name, ''),
      COALESCE(p_last_name, ''),
      p_role_title,
      NULLIF(btrim(COALESCE(p_email, '')), ''),
      NULLIF(btrim(COALESCE(p_phone, '')), ''),
      NOT EXISTS (SELECT 1 FROM public.client_contacts WHERE client_id = v_client_id AND is_primary = true)
    );
  ELSE
    UPDATE public.client_contacts SET
      first_name = COALESCE(NULLIF(btrim(p_first_name), ''), first_name),
      last_name  = COALESCE(NULLIF(btrim(p_last_name), ''), last_name),
      role_title = COALESCE(p_role_title, role_title),
      email      = COALESCE(NULLIF(btrim(p_email), ''), email),
      phone      = COALESCE(NULLIF(btrim(p_phone), ''), phone)
    WHERE id = v_contact_id;
  END IF;

  RETURN v_client_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.sync_trade_application_to_admin_directory()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_profile RECORD;
  v_studio RECORD;
BEGIN
  IF NEW.status <> 'approved'::trade_application_status THEN RETURN NEW; END IF;
  IF TG_OP = 'UPDATE' AND OLD.status = 'approved'::trade_application_status THEN RETURN NEW; END IF;

  SELECT first_name, last_name, email, phone INTO v_profile
  FROM public.profiles WHERE id = NEW.user_id;

  FOR v_studio IN
    SELECT s.id, s.created_by FROM public.studios s
    JOIN public.user_roles ur ON ur.user_id = s.created_by AND ur.role = 'admin'::app_role
  LOOP
    PERFORM public.upsert_admin_directory_client(
      v_studio.id,
      COALESCE(NEW.reviewed_by, v_studio.created_by),
      NEW.company_name,
      v_profile.first_name, v_profile.last_name, v_profile.email, v_profile.phone,
      NULLIF(NEW.job_title, ''),
      'Auto-added from approved trade application on ' || to_char(now(), 'YYYY-MM-DD')
    );
  END LOOP;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_trade_app_to_directory ON public.trade_applications;
CREATE TRIGGER trg_sync_trade_app_to_directory
AFTER INSERT OR UPDATE OF status ON public.trade_applications
FOR EACH ROW EXECUTE FUNCTION public.sync_trade_application_to_admin_directory();

CREATE OR REPLACE FUNCTION public.sync_inquiry_to_admin_directory()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_studio RECORD;
  v_first text; v_last text; v_parts text[];
BEGIN
  v_parts := regexp_split_to_array(btrim(COALESCE(NEW.name, '')), '\s+');
  v_first := COALESCE(v_parts[1], '');
  IF array_length(v_parts, 1) > 1 THEN
    v_last := array_to_string(v_parts[2:array_length(v_parts,1)], ' ');
  ELSE v_last := ''; END IF;

  FOR v_studio IN
    SELECT s.id, s.created_by FROM public.studios s
    JOIN public.user_roles ur ON ur.user_id = s.created_by AND ur.role = 'admin'::app_role
  LOOP
    PERFORM public.upsert_admin_directory_client(
      v_studio.id, v_studio.created_by,
      NULLIF(NEW.company, ''), v_first, v_last, NEW.email, NEW.phone, NULL,
      'Auto-added from ' || COALESCE(NEW.source, 'inquiry') || ' on ' || to_char(now(), 'YYYY-MM-DD')
    );
  END LOOP;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_inquiry_to_directory ON public.inquiries;
CREATE TRIGGER trg_sync_inquiry_to_directory
AFTER INSERT ON public.inquiries
FOR EACH ROW EXECUTE FUNCTION public.sync_inquiry_to_admin_directory();

-- Backfills
DO $$
DECLARE r RECORD; v_profile RECORD; v_studio RECORD;
BEGIN
  FOR r IN SELECT * FROM public.trade_applications WHERE status = 'approved'::trade_application_status LOOP
    SELECT first_name, last_name, email, phone INTO v_profile FROM public.profiles WHERE id = r.user_id;
    FOR v_studio IN
      SELECT s.id, s.created_by FROM public.studios s
      JOIN public.user_roles ur ON ur.user_id = s.created_by AND ur.role = 'admin'::app_role
    LOOP
      PERFORM public.upsert_admin_directory_client(
        v_studio.id, COALESCE(r.reviewed_by, v_studio.created_by), r.company_name,
        v_profile.first_name, v_profile.last_name, v_profile.email, v_profile.phone,
        NULLIF(r.job_title, ''), 'Backfilled from approved trade application'
      );
    END LOOP;
  END LOOP;
END $$;

DO $$
DECLARE r RECORD; v_studio RECORD; v_first text; v_last text; v_parts text[];
BEGIN
  FOR r IN SELECT * FROM public.inquiries WHERE created_at > now() - interval '12 months' LOOP
    v_parts := regexp_split_to_array(btrim(COALESCE(r.name, '')), '\s+');
    v_first := COALESCE(v_parts[1], '');
    IF array_length(v_parts, 1) > 1 THEN
      v_last := array_to_string(v_parts[2:array_length(v_parts,1)], ' ');
    ELSE v_last := ''; END IF;
    FOR v_studio IN
      SELECT s.id, s.created_by FROM public.studios s
      JOIN public.user_roles ur ON ur.user_id = s.created_by AND ur.role = 'admin'::app_role
    LOOP
      PERFORM public.upsert_admin_directory_client(
        v_studio.id, v_studio.created_by, NULLIF(r.company, ''),
        v_first, v_last, r.email, r.phone, NULL,
        'Backfilled from ' || COALESCE(r.source, 'inquiry')
      );
    END LOOP;
  END LOOP;
END $$;
