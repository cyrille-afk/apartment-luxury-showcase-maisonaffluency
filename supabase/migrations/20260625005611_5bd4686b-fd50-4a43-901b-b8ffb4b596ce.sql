REVOKE SELECT ON public.studio_invites FROM authenticated, anon;
GRANT SELECT (id, studio_id, email, role, invited_by, created_at, expires_at, accepted_at, accepted_by) ON public.studio_invites TO authenticated;
GRANT ALL ON public.studio_invites TO service_role;