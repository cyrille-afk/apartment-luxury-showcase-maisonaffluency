-- Remove broad authenticated read access to private studio rows.
DROP POLICY IF EXISTS "Authenticated users can view published studios" ON public.featured_studios;

-- Ensure admins can still read/manage and studio owners can read their own private row.
DROP POLICY IF EXISTS "Owners can view their own studio" ON public.featured_studios;
CREATE POLICY "Owners can view their own studio"
ON public.featured_studios
FOR SELECT
TO authenticated
USING (owner_user_id = auth.uid());

-- Helper used only by backend sync code to remove embedded pricing from public JSON projections.
CREATE OR REPLACE FUNCTION public.strip_public_variant_prices(_variants jsonb)
RETURNS jsonb
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT CASE
    WHEN _variants IS NULL THEN NULL
    WHEN jsonb_typeof(_variants) = 'array' THEN (
      SELECT COALESCE(
        jsonb_agg(elem - 'price_cents' - 'trade_price_cents' - 'price_per_sqm_cents' - 'price' - 'currency'),
        '[]'::jsonb
      )
      FROM jsonb_array_elements(_variants) AS elem
    )
    WHEN jsonb_typeof(_variants) = 'object' THEN
      _variants - 'price_cents' - 'trade_price_cents' - 'price_per_sqm_cents' - 'price' - 'currency'
    ELSE _variants
  END;
$$;

REVOKE ALL ON FUNCTION public.strip_public_variant_prices(jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.strip_public_variant_prices(jsonb) TO service_role;

-- Backfill already-public safe table rows.
UPDATE public.designer_curator_picks_public
SET size_variants = public.strip_public_variant_prices(size_variants)
WHERE size_variants IS NOT NULL;

-- Update the sync trigger so future public rows never include embedded price fields.
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
      NEW.gallery_images, NEW.origin, public.strip_public_variant_prices(NEW.size_variants), NEW.variant_placeholder,
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

-- Payout accounts contain bank/Stripe/tax data; only platform admins and studio owners/admins may read them.
DROP POLICY IF EXISTS "Studio members read payout accounts" ON public.studio_payout_accounts;
CREATE POLICY "Studio owners and admins read payout accounts"
ON public.studio_payout_accounts
FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR has_studio_role(auth.uid(), studio_id, 'owner'::studio_role)
  OR has_studio_role(auth.uid(), studio_id, 'admin'::studio_role)
);