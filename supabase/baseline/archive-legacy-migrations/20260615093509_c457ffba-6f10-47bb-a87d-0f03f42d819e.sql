
-- 1) Fabrics: restrict pricing exposure
DROP POLICY IF EXISTS "Active fabrics are publicly readable" ON public.fabrics;

CREATE POLICY "Active fabric swatches are publicly readable"
  ON public.fabrics FOR SELECT TO anon
  USING (is_active = true);

CREATE POLICY "Authenticated users can read active fabrics"
  ON public.fabrics FOR SELECT TO authenticated
  USING (is_active = true);

REVOKE SELECT ON public.fabrics FROM anon;
GRANT SELECT (id, name, description, image_url, category, supplier, sort_order, is_active, created_at, updated_at) ON public.fabrics TO anon;
GRANT SELECT ON public.fabrics TO authenticated;
GRANT ALL ON public.fabrics TO service_role;

-- 2) featured_studios: revoke full SELECT from authenticated; re-grant safe columns only.
REVOKE SELECT ON public.featured_studios FROM authenticated;
GRANT SELECT (
  id, slug, name, tagline, bio, founded_year, team_size, location, country,
  website_url, instagram_handle, logo_url, hero_image_url, gallery_images,
  disciplines, project_types, notable_projects, is_featured, is_published,
  sort_order, created_at, updated_at
) ON public.featured_studios TO authenticated;
GRANT ALL ON public.featured_studios TO service_role;

-- 3) concierge_leads: tighten insert WITH CHECK
DROP POLICY IF EXISTS "Anyone can insert a concierge lead" ON public.concierge_leads;
CREATE POLICY "Anyone can insert a concierge lead"
  ON public.concierge_leads FOR INSERT TO anon, authenticated
  WITH CHECK (user_id IS NULL OR user_id = auth.uid());
