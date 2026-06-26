
-- 1) studio_invites: lock down token column. Grant SELECT only on non-secret columns to authenticated.
REVOKE ALL ON public.studio_invites FROM anon, authenticated;
GRANT SELECT (id, studio_id, email, role, invited_by, accepted_at, accepted_by, expires_at, created_at)
  ON public.studio_invites TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.studio_invites TO authenticated;
GRANT ALL ON public.studio_invites TO service_role;

-- 2) featured_studios: hide contact_email from owner SELECT path; expose via SECURITY DEFINER RPC instead.
REVOKE ALL ON public.featured_studios FROM anon, authenticated;
GRANT SELECT (
  id, slug, name, tagline, bio, founded_year, team_size, location, country,
  website_url, instagram_handle, logo_url, hero_image_url, gallery_images,
  disciplines, project_types, notable_projects, is_featured, is_published,
  sort_order, created_at, updated_at, owner_user_id
) ON public.featured_studios TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.featured_studios TO authenticated;
GRANT ALL ON public.featured_studios TO service_role;

CREATE OR REPLACE FUNCTION public.get_studio_contact_email(_studio_id uuid)
RETURNS text
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE _email text;
BEGIN
  IF auth.uid() IS NULL THEN RETURN NULL; END IF;
  SELECT contact_email INTO _email
    FROM public.featured_studios
   WHERE id = _studio_id
     AND (owner_user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'::app_role));
  RETURN _email;
END;
$$;
REVOKE ALL ON FUNCTION public.get_studio_contact_email(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_studio_contact_email(uuid) TO authenticated, service_role;

-- 3) cron_http_call_log: revoke broad ACLs and add admin-only SELECT policy.
REVOKE ALL ON public.cron_http_call_log FROM anon, authenticated;
GRANT SELECT ON public.cron_http_call_log TO authenticated;
GRANT ALL ON public.cron_http_call_log TO service_role;

DROP POLICY IF EXISTS "Admins can view cron http call log" ON public.cron_http_call_log;
CREATE POLICY "Admins can view cron http call log"
  ON public.cron_http_call_log
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));
