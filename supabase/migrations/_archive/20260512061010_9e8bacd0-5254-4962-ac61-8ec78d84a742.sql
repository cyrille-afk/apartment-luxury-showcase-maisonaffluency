CREATE OR REPLACE FUNCTION public.is_client_trade_approved(_client_id uuid)
RETURNS TABLE(approved boolean, contact_email text, application_status text)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _email text;
  _status text;
BEGIN
  -- Caller must be able to see the client (studio member) OR be admin
  IF NOT EXISTS (
    SELECT 1 FROM public.clients c
    WHERE c.id = _client_id
      AND (public.can_view_studio(auth.uid(), c.studio_id) OR public.has_role(auth.uid(), 'admin'::app_role))
  ) THEN
    RETURN;
  END IF;

  -- Pick primary contact email, fallback to any contact email
  SELECT cc.email INTO _email
  FROM public.client_contacts cc
  WHERE cc.client_id = _client_id
    AND cc.email IS NOT NULL AND btrim(cc.email) <> ''
  ORDER BY cc.is_primary DESC NULLS LAST, cc.created_at ASC
  LIMIT 1;

  IF _email IS NULL THEN
    approved := false; contact_email := NULL; application_status := NULL;
    RETURN NEXT;
    RETURN;
  END IF;

  -- Latest application for the auth user matching that email
  SELECT ta.status::text INTO _status
  FROM public.trade_applications ta
  JOIN public.profiles p ON p.id = ta.user_id
  WHERE lower(p.email) = lower(_email)
  ORDER BY ta.created_at DESC
  LIMIT 1;

  approved := (_status = 'approved');
  contact_email := _email;
  application_status := _status;
  RETURN NEXT;
END;
$$;

GRANT EXECUTE ON FUNCTION public.is_client_trade_approved(uuid) TO authenticated;