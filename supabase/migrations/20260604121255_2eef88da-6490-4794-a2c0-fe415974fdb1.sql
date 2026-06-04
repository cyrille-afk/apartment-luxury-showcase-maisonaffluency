-- Resolve publish security review findings with explicit privilege and RLS hardening.

-- 1) Trade pricing table: only trade users and admins may read pricing rows.
DROP POLICY IF EXISTS "Authenticated can read trade pricing" ON public.trade_product_pricing;
DROP POLICY IF EXISTS "Trade users and admins can read trade pricing" ON public.trade_product_pricing;
CREATE POLICY "Trade users and admins can read trade pricing"
  ON public.trade_product_pricing
  FOR SELECT
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'trade_user'::app_role)
    OR public.has_role(auth.uid(), 'admin'::app_role)
  );

-- 2) Designer curator picks: public/anon may read only non-sensitive columns.
--    Authenticated users retain table privileges, but RLS still gates full-row reads.
REVOKE ALL ON public.designer_curator_picks FROM anon;
GRANT SELECT (
  id, designer_id, image_url, hover_image_url, title, subtitle,
  category, subcategory, tags, materials, dimensions, description,
  edition, photo_credit, pdf_url, pdf_filename, pdf_urls, sort_order,
  created_at, currency, lead_time, price_prefix, gallery_images, origin,
  size_variants, variant_placeholder, base_axis_label, top_axis_label,
  variant_image_map, is_hidden, edition_number, edition_signing,
  pack_cbm, pack_weight_kg, pack_carton_count, default_ship_mode,
  pickup_country, pickup_postcode, pickup_address,
  embedding_source_hash, embedded_at, materials_description
) ON public.designer_curator_picks TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.designer_curator_picks TO authenticated;
GRANT ALL ON public.designer_curator_picks TO service_role;

DROP POLICY IF EXISTS "Public can view non-hidden curator picks" ON public.designer_curator_picks;
DROP POLICY IF EXISTS "Anon can view non-hidden curator picks" ON public.designer_curator_picks;
DROP POLICY IF EXISTS "Trade users and admins can view curator picks" ON public.designer_curator_picks;
CREATE POLICY "Anon can view non-hidden curator picks"
  ON public.designer_curator_picks
  FOR SELECT
  TO anon
  USING (COALESCE(is_hidden, false) = false);
CREATE POLICY "Trade users and admins can view curator picks"
  ON public.designer_curator_picks
  FOR SELECT
  TO authenticated
  USING (
    COALESCE(is_hidden, false) = false
    OR public.has_role(auth.uid(), 'trade_user'::app_role)
    OR public.has_role(auth.uid(), 'admin'::app_role)
  );

-- 3) Public view remains the intended anonymous surface and excludes pricing fields.
DROP VIEW IF EXISTS public.designer_curator_picks_public;
CREATE VIEW public.designer_curator_picks_public
WITH (security_invoker = on) AS
SELECT
  id, designer_id, image_url, hover_image_url, title, subtitle,
  category, subcategory, tags, materials, dimensions, description,
  edition, photo_credit, pdf_url, pdf_filename, pdf_urls, sort_order,
  created_at, currency, lead_time, price_prefix, gallery_images, origin,
  size_variants, variant_placeholder, base_axis_label, top_axis_label,
  variant_image_map, is_hidden, edition_number, edition_signing,
  pack_cbm, pack_weight_kg, pack_carton_count, default_ship_mode,
  pickup_country, pickup_postcode, pickup_address, materials_description
FROM public.designer_curator_picks
WHERE COALESCE(is_hidden, false) = false;
GRANT SELECT ON public.designer_curator_picks_public TO anon, authenticated;

-- 4) Featured studios: public/anon may read only non-sensitive columns.
REVOKE ALL ON public.featured_studios FROM anon;
GRANT SELECT (
  id, slug, name, tagline, bio, founded_year, team_size, location, country,
  website_url, instagram_handle, logo_url, hero_image_url, gallery_images,
  disciplines, project_types, notable_projects, is_featured, is_published,
  sort_order, created_at, updated_at, owner_user_id
) ON public.featured_studios TO anon;
GRANT SELECT ON public.featured_studios TO authenticated;
GRANT ALL ON public.featured_studios TO service_role;