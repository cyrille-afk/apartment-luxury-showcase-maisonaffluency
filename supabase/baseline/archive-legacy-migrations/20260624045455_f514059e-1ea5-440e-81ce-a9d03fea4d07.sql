
-- Defense in depth: enforce column-level secrecy independent of RLS policies.

-- 1) featured_studios.contact_email — hide from anon + authenticated, allow service_role only.
REVOKE SELECT (contact_email) ON public.featured_studios FROM PUBLIC;
REVOKE SELECT (contact_email) ON public.featured_studios FROM anon;
REVOKE SELECT (contact_email) ON public.featured_studios FROM authenticated;
GRANT SELECT (contact_email) ON public.featured_studios TO service_role;

COMMENT ON COLUMN public.featured_studios.contact_email IS
  'PRIVATE. Readable only by service_role. Owners/admins read via server-side functions or trusted views.';

-- 2) studio_invites.token — hide from anon + authenticated; only service_role can read raw tokens.
REVOKE SELECT ON public.studio_invites FROM anon;
REVOKE SELECT ON public.studio_invites FROM authenticated;
REVOKE SELECT (token) ON public.studio_invites FROM PUBLIC;
REVOKE SELECT (token) ON public.studio_invites FROM anon;
REVOKE SELECT (token) ON public.studio_invites FROM authenticated;

-- Re-grant SELECT on every non-secret column to authenticated so the existing
-- "Studio admins can view invites" RLS policy still works for management UI.
GRANT SELECT
  (id, studio_id, email, role, invited_by, accepted_at, accepted_by, expires_at, created_at)
  ON public.studio_invites TO authenticated;

GRANT SELECT ON public.studio_invites TO service_role;

COMMENT ON COLUMN public.studio_invites.token IS
  'PRIVATE. Readable only by service_role. Edge functions accept invites by token; clients never see raw values.';
