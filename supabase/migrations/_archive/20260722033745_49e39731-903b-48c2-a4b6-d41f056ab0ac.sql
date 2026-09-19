
-- 1) cad_fit_edit_audit: require trade_user or admin on insert
DROP POLICY IF EXISTS "Users insert their own fit edit audit" ON public.cad_fit_edit_audit;
CREATE POLICY "Users insert their own fit edit audit"
ON public.cad_fit_edit_audit
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = user_id
  AND (public.has_role(auth.uid(), 'trade_user'::app_role) OR public.has_role(auth.uid(), 'admin'::app_role))
);

-- 2) profiles: revoke UPDATE on privileged tier columns from authenticated so
-- non-admin users cannot modify them even if RLS allows the row. Admin path
-- uses SECURITY DEFINER/service_role and remains unaffected. Triggers already
-- provide belt-and-braces protection.
REVOKE UPDATE ON public.profiles FROM authenticated;
GRANT UPDATE (
  email,
  first_name,
  last_name,
  company,
  phone,
  avatar_url,
  country,
  concierge_name,
  has_seen_trade_intro
) ON public.profiles TO authenticated;
