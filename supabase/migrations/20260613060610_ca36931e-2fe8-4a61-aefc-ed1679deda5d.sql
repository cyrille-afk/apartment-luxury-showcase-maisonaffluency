-- Replace anon-facing base-table policies with safe public views.
-- This avoids relying on column grants alone, because RLS policies are row-only and scanners correctly flag public base-table SELECT policies as exposing all columns.

-- Featured studios: no direct public/anon SELECT on the base table.
DROP POLICY IF EXISTS "Anyone can view published studios" ON public.featured_studios;
DROP POLICY IF EXISTS "Owners can view their own studio" ON public.featured_studios;

-- Keep the base table reachable to signed-in users/admins only; RLS still decides which rows they can access.
GRANT SELECT ON public.featured_studios TO authenticated;
GRANT ALL ON public.featured_studios TO service_role;
REVOKE ALL ON public.featured_studios FROM anon;
REVOKE SELECT (contact_email, owner_user_id) ON public.featured_studios FROM anon;

CREATE OR REPLACE VIEW public.featured_studios_public AS
SELECT
  id,
  slug,
  name,
  tagline,
  bio,
  founded_year,
  team_size,
  location,
  country,
  website_url,
  instagram_handle,
  logo_url,
  hero_image_url,
  gallery_images,
  disciplines,
  project_types,
  notable_projects,
  is_featured,
  is_published,
  sort_order,
  created_at,
  updated_at
FROM public.featured_studios
WHERE is_published = true;

GRANT SELECT ON public.featured_studios_public TO anon, authenticated;
GRANT ALL ON public.featured_studios_public TO service_role;

-- Signed-in owners can still see their own base-table row; admins keep the existing manage policy.
CREATE POLICY "Owners can view their own studio"
ON public.featured_studios
FOR SELECT
TO authenticated
USING (owner_user_id = auth.uid());

-- Designer curator picks: no direct public/anon SELECT on the base table.
DROP POLICY IF EXISTS "Public can view visible curator picks" ON public.designer_curator_picks;

GRANT SELECT ON public.designer_curator_picks TO authenticated;
GRANT ALL ON public.designer_curator_picks TO service_role;
REVOKE ALL ON public.designer_curator_picks FROM anon;
REVOKE SELECT (trade_price_cents, price_per_sqm_cents) ON public.designer_curator_picks FROM anon;

CREATE OR REPLACE VIEW public.designer_curator_picks_public AS
SELECT
  id,
  designer_id,
  image_url,
  hover_image_url,
  title,
  subtitle,
  category,
  subcategory,
  tags,
  materials,
  dimensions,
  description,
  edition,
  photo_credit,
  pdf_url,
  pdf_filename,
  pdf_urls,
  sort_order,
  created_at,
  currency,
  lead_time,
  price_prefix,
  gallery_images,
  origin,
  size_variants,
  variant_placeholder,
  base_axis_label,
  top_axis_label,
  variant_image_map,
  is_hidden,
  edition_number,
  edition_signing,
  pack_cbm,
  pack_weight_kg,
  pack_carton_count,
  default_ship_mode,
  pickup_country,
  pickup_postcode,
  pickup_address,
  materials_description,
  gallery_captions
FROM public.designer_curator_picks
WHERE COALESCE(is_hidden, false) = false;

GRANT SELECT ON public.designer_curator_picks_public TO anon, authenticated;
GRANT ALL ON public.designer_curator_picks_public TO service_role;