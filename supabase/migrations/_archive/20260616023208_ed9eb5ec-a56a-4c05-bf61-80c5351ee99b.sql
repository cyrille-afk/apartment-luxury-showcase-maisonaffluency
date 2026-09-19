DROP VIEW IF EXISTS public.client_contacts_safe;

CREATE OR REPLACE FUNCTION public.get_client_contacts_safe(_client_id uuid)
RETURNS TABLE (
  id uuid,
  client_id uuid,
  first_name text,
  last_name text,
  role_title text,
  email text,
  phone text,
  is_primary boolean,
  notes text,
  created_at timestamptz,
  updated_at timestamptz,
  can_edit boolean
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _studio_id uuid;
  _can_edit boolean;
  _can_view boolean;
BEGIN
  SELECT c.studio_id INTO _studio_id FROM public.clients c WHERE c.id = _client_id;
  IF _studio_id IS NULL THEN RETURN; END IF;

  _can_edit := public.can_edit_studio(auth.uid(), _studio_id);
  _can_view := _can_edit OR public.can_view_studio(auth.uid(), _studio_id);
  IF NOT _can_view THEN RETURN; END IF;

  RETURN QUERY
  SELECT
    cc.id,
    cc.client_id,
    cc.first_name,
    cc.last_name,
    cc.role_title,
    CASE
      WHEN _can_edit THEN cc.email
      WHEN cc.email IS NULL OR cc.email = '' THEN cc.email
      ELSE regexp_replace(cc.email, '(^.).*(@.*$)', '\1•••\2')
    END AS email,
    CASE
      WHEN _can_edit THEN cc.phone
      WHEN cc.phone IS NULL OR cc.phone = '' THEN cc.phone
      ELSE regexp_replace(cc.phone, '.(?=.{2})', '•', 'g')
    END AS phone,
    cc.is_primary,
    CASE WHEN _can_edit THEN cc.notes ELSE NULL END AS notes,
    cc.created_at,
    cc.updated_at,
    _can_edit AS can_edit
  FROM public.client_contacts cc
  WHERE cc.client_id = _client_id
  ORDER BY cc.is_primary DESC NULLS LAST, cc.created_at ASC;
END;
$$;

REVOKE ALL ON FUNCTION public.get_client_contacts_safe(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_client_contacts_safe(uuid) TO authenticated;