
-- Fix 1: Hide trade-only designer profiles from public anon reads
DROP POLICY IF EXISTS "Anyone can view published designers" ON public.designers;
CREATE POLICY "Anyone can view published designers"
  ON public.designers FOR SELECT
  USING (is_published = true AND trade_only = false);

-- Fix 2: Prevent studio admins from reading invite tokens (acceptance link).
-- Token is only needed server-side during invite acceptance via service_role.
REVOKE SELECT (token) ON public.studio_invites FROM authenticated;
REVOKE SELECT (token) ON public.studio_invites FROM anon;
