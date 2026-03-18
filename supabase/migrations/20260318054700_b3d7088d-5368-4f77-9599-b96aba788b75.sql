
-- Fix the overly permissive INSERT policy - restrict to trigger (security definer) context
DROP POLICY "Authenticated can insert audit log" ON public.sample_request_audit_log;

-- The trigger function runs as SECURITY DEFINER so it bypasses RLS.
-- Only allow service_role direct inserts as a fallback.
CREATE POLICY "Service role can insert audit log"
  ON public.sample_request_audit_log FOR INSERT
  TO public
  WITH CHECK (auth.role() = 'service_role'::text);
