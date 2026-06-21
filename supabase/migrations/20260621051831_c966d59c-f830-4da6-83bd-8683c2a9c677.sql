-- Revoke column-level SELECT on the secret invite token from client roles.
-- Only service_role (used by edge functions) should be able to read the raw token.
REVOKE SELECT (token) ON public.studio_invites FROM authenticated;
REVOKE SELECT (token) ON public.studio_invites FROM anon;
REVOKE SELECT (token) ON public.studio_invites FROM PUBLIC;

-- Re-grant the non-secret columns explicitly to authenticated so the
-- TradeStudioSettings page can keep listing pending invites.
GRANT SELECT (id, studio_id, email, role, invited_by, created_at, expires_at, accepted_at)
  ON public.studio_invites TO authenticated;