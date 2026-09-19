
CREATE OR REPLACE FUNCTION public.get_my_pending_invites()
RETURNS TABLE (
  id uuid,
  studio_id uuid,
  studio_name text,
  role studio_role,
  invited_by_name text,
  expires_at timestamptz,
  created_at timestamptz,
  is_expired boolean,
  is_accepted boolean
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    i.id,
    i.studio_id,
    s.name AS studio_name,
    i.role,
    COALESCE(NULLIF(TRIM(CONCAT(p.first_name, ' ', p.last_name)), ''), p.first_name, p.last_name) AS invited_by_name,
    i.expires_at,
    i.created_at,
    (i.expires_at IS NOT NULL AND i.expires_at < now()) AS is_expired,
    (i.accepted_at IS NOT NULL) AS is_accepted
  FROM public.studio_invites i
  LEFT JOIN public.studios s ON s.id = i.studio_id
  LEFT JOIN public.profiles p ON p.id = i.invited_by
  WHERE lower(i.email) = lower((SELECT email FROM auth.users WHERE id = auth.uid()))
    AND i.accepted_at IS NULL
  ORDER BY i.created_at DESC;
$$;

REVOKE ALL ON FUNCTION public.get_my_pending_invites() FROM public;
GRANT EXECUTE ON FUNCTION public.get_my_pending_invites() TO authenticated;
