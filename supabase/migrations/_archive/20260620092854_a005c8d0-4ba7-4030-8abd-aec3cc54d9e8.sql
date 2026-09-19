-- Prevent studio admins from reading the invite acceptance token via SELECT.
-- Token is server-side only (consumed by service_role during invite acceptance).
REVOKE SELECT (token) ON public.studio_invites FROM authenticated;
REVOKE SELECT (token) ON public.studio_invites FROM anon;