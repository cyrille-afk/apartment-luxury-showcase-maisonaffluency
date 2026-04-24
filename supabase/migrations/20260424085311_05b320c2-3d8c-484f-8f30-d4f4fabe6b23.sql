CREATE OR REPLACE FUNCTION public.get_admin_user_ids()
RETURNS TABLE(user_id uuid)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT DISTINCT ur.user_id
  FROM public.user_roles ur
  WHERE ur.role IN ('admin'::app_role, 'super_admin'::app_role)
    AND public.has_role(auth.uid(), 'admin'::app_role);
$$;

REVOKE ALL ON FUNCTION public.get_admin_user_ids() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_admin_user_ids() TO authenticated;