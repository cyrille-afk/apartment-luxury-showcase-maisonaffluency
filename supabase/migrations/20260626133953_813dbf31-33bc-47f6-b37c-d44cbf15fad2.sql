
-- Lock down studio_invites.token: only service_role may read it.
REVOKE SELECT ON public.studio_invites FROM authenticated, anon;
GRANT SELECT (id, studio_id, email, role, invited_by, accepted_at, accepted_by, expires_at, created_at)
  ON public.studio_invites TO authenticated;
GRANT ALL ON public.studio_invites TO service_role;
