
-- Roll back the over-restrictive SELECT we just added
DROP POLICY IF EXISTS "Trade and admins can view published studios with contact" ON public.featured_studios;
DROP VIEW IF EXISTS public.featured_studios_public;

-- Restore the public SELECT policy
CREATE POLICY "Anyone can view published studios"
ON public.featured_studios FOR SELECT
USING (is_published = true);

-- Allow the studio owner to view their own row regardless of publish state
CREATE POLICY "Owners can view their own studio"
ON public.featured_studios FOR SELECT
USING (auth.uid() IS NOT NULL AND owner_user_id = auth.uid());

-- Column-level privilege: hide contact_email from anon and authenticated.
-- Admins use service_role / their own privileged path; this protects the API.
REVOKE SELECT ON public.featured_studios FROM anon, authenticated;
GRANT SELECT (
  id, slug, name, tagline, bio, founded_year, team_size, location, country,
  website_url, instagram_handle, logo_url, hero_image_url, gallery_images,
  disciplines, project_types, notable_projects, is_featured, is_published,
  sort_order, created_at, updated_at, owner_user_id
) ON public.featured_studios TO anon, authenticated;

-- service_role keeps full access (for admin tooling / edge functions)
GRANT SELECT ON public.featured_studios TO service_role;
