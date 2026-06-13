-- Replace safe projection views with real public tables so anon never queries the private base tables.

DROP VIEW IF EXISTS public.featured_studios_public;

CREATE TABLE public.featured_studios_public AS
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

ALTER TABLE public.featured_studios_public ADD PRIMARY KEY (id);
GRANT SELECT ON public.featured_studios_public TO anon, authenticated;
GRANT ALL ON public.featured_studios_public TO service_role;
ALTER TABLE public.featured_studios_public ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public can view published featured studios"
ON public.featured_studios_public
FOR SELECT
TO anon, authenticated
USING (true);

DROP VIEW IF EXISTS public.designer_curator_picks_public;

CREATE TABLE public.designer_curator_picks_public AS
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

ALTER TABLE public.designer_curator_picks_public ADD PRIMARY KEY (id);
GRANT SELECT ON public.designer_curator_picks_public TO anon, authenticated;
GRANT ALL ON public.designer_curator_picks_public TO service_role;
ALTER TABLE public.designer_curator_picks_public ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public can view visible curator picks safe projection"
ON public.designer_curator_picks_public
FOR SELECT
TO anon, authenticated
USING (true);

-- Private base tables: no anonymous grants or public anon-facing policies.
REVOKE ALL ON public.featured_studios FROM anon;
REVOKE ALL ON public.designer_curator_picks FROM anon;
DROP POLICY IF EXISTS "Public can view visible curator picks" ON public.designer_curator_picks;
DROP POLICY IF EXISTS "Trade users and admins can view curator picks" ON public.designer_curator_picks;
CREATE POLICY "Trade users and admins can view curator picks"
ON public.designer_curator_picks
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'trade_user'::app_role) OR has_role(auth.uid(), 'admin'::app_role));

-- Signed-in users may view published studio rows, including contact_email for the member-facing mailto CTA.
DROP POLICY IF EXISTS "Authenticated users can view published studios" ON public.featured_studios;
CREATE POLICY "Authenticated users can view published studios"
ON public.featured_studios
FOR SELECT
TO authenticated
USING (is_published = true);

-- Sync safe public studio rows from the private source table.
CREATE OR REPLACE FUNCTION public.sync_featured_studios_public()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    DELETE FROM public.featured_studios_public WHERE id = OLD.id;
    RETURN OLD;
  END IF;

  IF NEW.is_published THEN
    INSERT INTO public.featured_studios_public (
      id, slug, name, tagline, bio, founded_year, team_size, location, country,
      website_url, instagram_handle, logo_url, hero_image_url, gallery_images,
      disciplines, project_types, notable_projects, is_featured, is_published,
      sort_order, created_at, updated_at
    ) VALUES (
      NEW.id, NEW.slug, NEW.name, NEW.tagline, NEW.bio, NEW.founded_year,
      NEW.team_size, NEW.location, NEW.country, NEW.website_url,
      NEW.instagram_handle, NEW.logo_url, NEW.hero_image_url, NEW.gallery_images,
      NEW.disciplines, NEW.project_types, NEW.notable_projects, NEW.is_featured,
      NEW.is_published, NEW.sort_order, NEW.created_at, NEW.updated_at
    )
    ON CONFLICT (id) DO UPDATE SET
      slug = EXCLUDED.slug,
      name = EXCLUDED.name,
      tagline = EXCLUDED.tagline,
      bio = EXCLUDED.bio,
      founded_year = EXCLUDED.founded_year,
      team_size = EXCLUDED.team_size,
      location = EXCLUDED.location,
      country = EXCLUDED.country,
      website_url = EXCLUDED.website_url,
      instagram_handle = EXCLUDED.instagram_handle,
      logo_url = EXCLUDED.logo_url,
      hero_image_url = EXCLUDED.hero_image_url,
      gallery_images = EXCLUDED.gallery_images,
      disciplines = EXCLUDED.disciplines,
      project_types = EXCLUDED.project_types,
      notable_projects = EXCLUDED.notable_projects,
      is_featured = EXCLUDED.is_featured,
      is_published = EXCLUDED.is_published,
      sort_order = EXCLUDED.sort_order,
      created_at = EXCLUDED.created_at,
      updated_at = EXCLUDED.updated_at;
  ELSE
    DELETE FROM public.featured_studios_public WHERE id = NEW.id;
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.sync_featured_studios_public() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.sync_featured_studios_public() TO service_role;

DROP TRIGGER IF EXISTS trg_sync_featured_studios_public ON public.featured_studios;
CREATE TRIGGER trg_sync_featured_studios_public
AFTER INSERT OR UPDATE OR DELETE ON public.featured_studios
FOR EACH ROW EXECUTE FUNCTION public.sync_featured_studios_public();

-- Sync safe public curator-pick rows from the private source table.
CREATE OR REPLACE FUNCTION public.sync_designer_curator_picks_public()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    DELETE FROM public.designer_curator_picks_public WHERE id = OLD.id;
    RETURN OLD;
  END IF;

  IF COALESCE(NEW.is_hidden, false) = false THEN
    INSERT INTO public.designer_curator_picks_public (
      id, designer_id, image_url, hover_image_url, title, subtitle, category,
      subcategory, tags, materials, dimensions, description, edition,
      photo_credit, pdf_url, pdf_filename, pdf_urls, sort_order, created_at,
      currency, lead_time, price_prefix, gallery_images, origin, size_variants,
      variant_placeholder, base_axis_label, top_axis_label, variant_image_map,
      is_hidden, edition_number, edition_signing, pack_cbm, pack_weight_kg,
      pack_carton_count, default_ship_mode, pickup_country, pickup_postcode,
      pickup_address, materials_description, gallery_captions
    ) VALUES (
      NEW.id, NEW.designer_id, NEW.image_url, NEW.hover_image_url, NEW.title,
      NEW.subtitle, NEW.category, NEW.subcategory, NEW.tags, NEW.materials,
      NEW.dimensions, NEW.description, NEW.edition, NEW.photo_credit,
      NEW.pdf_url, NEW.pdf_filename, NEW.pdf_urls, NEW.sort_order,
      NEW.created_at, NEW.currency, NEW.lead_time, NEW.price_prefix,
      NEW.gallery_images, NEW.origin, NEW.size_variants, NEW.variant_placeholder,
      NEW.base_axis_label, NEW.top_axis_label, NEW.variant_image_map,
      NEW.is_hidden, NEW.edition_number, NEW.edition_signing, NEW.pack_cbm,
      NEW.pack_weight_kg, NEW.pack_carton_count, NEW.default_ship_mode,
      NEW.pickup_country, NEW.pickup_postcode, NEW.pickup_address,
      NEW.materials_description, NEW.gallery_captions
    )
    ON CONFLICT (id) DO UPDATE SET
      designer_id = EXCLUDED.designer_id,
      image_url = EXCLUDED.image_url,
      hover_image_url = EXCLUDED.hover_image_url,
      title = EXCLUDED.title,
      subtitle = EXCLUDED.subtitle,
      category = EXCLUDED.category,
      subcategory = EXCLUDED.subcategory,
      tags = EXCLUDED.tags,
      materials = EXCLUDED.materials,
      dimensions = EXCLUDED.dimensions,
      description = EXCLUDED.description,
      edition = EXCLUDED.edition,
      photo_credit = EXCLUDED.photo_credit,
      pdf_url = EXCLUDED.pdf_url,
      pdf_filename = EXCLUDED.pdf_filename,
      pdf_urls = EXCLUDED.pdf_urls,
      sort_order = EXCLUDED.sort_order,
      created_at = EXCLUDED.created_at,
      currency = EXCLUDED.currency,
      lead_time = EXCLUDED.lead_time,
      price_prefix = EXCLUDED.price_prefix,
      gallery_images = EXCLUDED.gallery_images,
      origin = EXCLUDED.origin,
      size_variants = EXCLUDED.size_variants,
      variant_placeholder = EXCLUDED.variant_placeholder,
      base_axis_label = EXCLUDED.base_axis_label,
      top_axis_label = EXCLUDED.top_axis_label,
      variant_image_map = EXCLUDED.variant_image_map,
      is_hidden = EXCLUDED.is_hidden,
      edition_number = EXCLUDED.edition_number,
      edition_signing = EXCLUDED.edition_signing,
      pack_cbm = EXCLUDED.pack_cbm,
      pack_weight_kg = EXCLUDED.pack_weight_kg,
      pack_carton_count = EXCLUDED.pack_carton_count,
      default_ship_mode = EXCLUDED.default_ship_mode,
      pickup_country = EXCLUDED.pickup_country,
      pickup_postcode = EXCLUDED.pickup_postcode,
      pickup_address = EXCLUDED.pickup_address,
      materials_description = EXCLUDED.materials_description,
      gallery_captions = EXCLUDED.gallery_captions;
  ELSE
    DELETE FROM public.designer_curator_picks_public WHERE id = NEW.id;
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.sync_designer_curator_picks_public() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.sync_designer_curator_picks_public() TO service_role;

DROP TRIGGER IF EXISTS trg_sync_designer_curator_picks_public ON public.designer_curator_picks;
CREATE TRIGGER trg_sync_designer_curator_picks_public
AFTER INSERT OR UPDATE OR DELETE ON public.designer_curator_picks
FOR EACH ROW EXECUTE FUNCTION public.sync_designer_curator_picks_public();