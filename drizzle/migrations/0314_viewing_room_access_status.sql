CREATE OR REPLACE FUNCTION public.get_viewing_room_access_status(_token text)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE
    WHEN d.access_revoked_at IS NOT NULL THEN 'revoked'
    WHEN d.access_expires_at IS NOT NULL AND d.access_expires_at <= now() THEN 'expired'
    ELSE 'invalid'
  END
  FROM public.developer_projects d
  WHERE d.access_token = _token
  LIMIT 1;
$$;
REVOKE ALL ON FUNCTION public.get_viewing_room_access_status(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_viewing_room_access_status(text) TO anon, authenticated;