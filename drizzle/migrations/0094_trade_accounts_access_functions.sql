CREATE OR REPLACE FUNCTION public.trade_accounts_grant_access()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE uid uuid;
BEGIN
  IF NEW.status = 'approved' AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM 'approved') THEN
    uid := NEW.user_id;
    IF uid IS NULL THEN
      SELECT id INTO uid FROM public.profiles WHERE lower(email) = lower(NEW.email) LIMIT 1;
      IF uid IS NOT NULL THEN NEW.user_id := uid; END IF;
    END IF;
    IF uid IS NOT NULL THEN
      INSERT INTO public.user_roles(user_id, role) VALUES (uid, 'trade_user') ON CONFLICT DO NOTHING;
      UPDATE public.profiles SET trade_status = 'approved' WHERE id = uid;
    END IF;
  END IF;
  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.is_approved_trade_user(_user_id uuid DEFAULT auth.uid())
 RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  SELECT _user_id IS NOT NULL AND (
    public.has_role(_user_id, 'admin'::app_role)
    OR public.has_role(_user_id, 'super_admin'::app_role)
    OR (
      public.has_role(_user_id, 'trade_user'::app_role)
      AND (
        EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = _user_id AND p.trade_status = 'approved')
        OR EXISTS (SELECT 1 FROM public.trade_accounts t WHERE t.user_id = _user_id AND t.status = 'approved')
      )
    )
  )
$function$;

CREATE OR REPLACE FUNCTION public.is_client_trade_approved(_client_id uuid)
 RETURNS TABLE(approved boolean, contact_email text, application_status text)
 LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE _email text; _status text;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.clients c
    WHERE c.id = _client_id
      AND (public.can_view_studio(auth.uid(), c.studio_id) OR public.has_role(auth.uid(), 'admin'::app_role))
  ) THEN RETURN; END IF;
  SELECT cc.email INTO _email FROM public.client_contacts cc
  WHERE cc.client_id = _client_id AND cc.email IS NOT NULL AND btrim(cc.email) <> ''
  ORDER BY cc.is_primary DESC NULLS LAST, cc.created_at ASC LIMIT 1;
  IF _email IS NULL THEN
    approved := false; contact_email := NULL; application_status := NULL; RETURN NEXT; RETURN;
  END IF;
  SELECT t.status INTO _status FROM public.trade_accounts t
  WHERE lower(t.email) = lower(_email) ORDER BY t.created_at DESC LIMIT 1;
  approved := (_status = 'approved');
  contact_email := _email;
  application_status := CASE WHEN _status = 'pending_review' THEN 'pending' ELSE _status END;
  RETURN NEXT;
END;
$function$;

-- Legacy table is now a read-only backup
REVOKE INSERT, UPDATE, DELETE ON public.trade_applications FROM anon, authenticated;