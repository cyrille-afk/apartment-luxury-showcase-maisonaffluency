-- Per-product default variant.
--
-- Some products should arrive with one size already chosen (e.g. the Galet
-- Dining Tables open on Large) instead of the empty "Select Your Size"
-- placeholder. NULL keeps today's behaviour: nothing is pre-selected.
--
-- The value is a label (or the leading word of one, e.g. "Large") matched
-- against size_variants[].label by src/lib/variantDefault.ts.

ALTER TABLE public.designer_curator_picks
  ADD COLUMN IF NOT EXISTS default_variant_label text;

ALTER TABLE public.designer_curator_picks_public
  ADD COLUMN IF NOT EXISTS default_variant_label text;

ALTER TABLE public.trade_products
  ADD COLUMN IF NOT EXISTS default_variant_label text;

COMMENT ON COLUMN public.designer_curator_picks.default_variant_label IS
  'Size/finish variant the product page opens with pre-selected; matched against size_variants[].label.';

-- ── Mirror the new column into the public picks table ───────────────────────
CREATE OR REPLACE FUNCTION public.sync_designer_curator_picks_public()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF TG_OP = 'DELETE' THEN
    DELETE FROM public.designer_curator_picks_public WHERE id = OLD.id;
    RETURN OLD;
  END IF;

  IF COALESCE(NEW.is_hidden, false) = false AND COALESCE(NEW.trade_only, false) = false THEN
    INSERT INTO public.designer_curator_picks_public (
      id, designer_id, image_url, hover_image_url, title, subtitle, category,
      subcategory, tags, materials, dimensions, description, edition,
      photo_credit, pdf_url, pdf_filename, pdf_urls, sort_order, created_at,
      currency, lead_time, price_prefix, gallery_images, origin, size_variants,
      variant_placeholder, base_axis_label, top_axis_label, variant_image_map,
      is_hidden, edition_number, edition_signing, default_ship_mode,
      materials_description, gallery_captions, is_upholstered,
      wood_label_override, allow_com_col, slug, default_variant_label
    ) VALUES (
      NEW.id, NEW.designer_id, NEW.image_url, NEW.hover_image_url, NEW.title,
      NEW.subtitle, NEW.category, NEW.subcategory, NEW.tags, NEW.materials,
      NEW.dimensions, NEW.description, NEW.edition, NEW.photo_credit,
      NEW.pdf_url, NEW.pdf_filename, NEW.pdf_urls, NEW.sort_order,
      NEW.created_at, NEW.currency, NEW.lead_time, NEW.price_prefix,
      NEW.gallery_images, NEW.origin, public.strip_public_variant_prices(NEW.size_variants), NEW.variant_placeholder,
      NEW.base_axis_label, NEW.top_axis_label, NEW.variant_image_map,
      NEW.is_hidden, NEW.edition_number, NEW.edition_signing, NEW.default_ship_mode,
      NEW.materials_description, NEW.gallery_captions, NEW.is_upholstered,
      NEW.wood_label_override, NEW.allow_com_col, NEW.slug, NEW.default_variant_label
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
      default_ship_mode = EXCLUDED.default_ship_mode,
      materials_description = EXCLUDED.materials_description,
      gallery_captions = EXCLUDED.gallery_captions,
      is_upholstered = EXCLUDED.is_upholstered,
      wood_label_override = EXCLUDED.wood_label_override,
      allow_com_col = EXCLUDED.allow_com_col,
      slug = EXCLUDED.slug,
      default_variant_label = EXCLUDED.default_variant_label;
  ELSE
    DELETE FROM public.designer_curator_picks_public WHERE id = NEW.id;
  END IF;

  RETURN NEW;
END;
$function$;

-- ── Mirror the new column into the trade product twin ───────────────────────
CREATE OR REPLACE FUNCTION public.sync_curator_pick_to_trade_product()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _brand_name text;
  _existing_id uuid;
  _rrp_cents integer;
  _pick_age_sec numeric;
BEGIN
  SELECT name INTO _brand_name FROM public.designers WHERE id = NEW.designer_id;
  IF _brand_name IS NULL OR NEW.title IS NULL OR btrim(NEW.title) = '' THEN
    RETURN NEW;
  END IF;

  _rrp_cents := NEW.trade_price_cents;

  SELECT id INTO _existing_id
  FROM public.trade_products
  WHERE source_pick_id = NEW.id
  LIMIT 1;

  IF _existing_id IS NULL THEN
    SELECT id INTO _existing_id
    FROM public.trade_products
    WHERE brand_name = _brand_name AND product_name = NEW.title
    LIMIT 1;
  END IF;

  IF _existing_id IS NOT NULL THEN
    UPDATE public.trade_products tp
    SET
      product_name          = NEW.title,
      source_pick_id        = NEW.id,
      trade_price_cents     = COALESCE(NEW.trade_price_cents,     tp.trade_price_cents),
      rrp_price_cents       = COALESCE(_rrp_cents,                tp.rrp_price_cents),
      price_per_sqm_cents   = COALESCE(NEW.price_per_sqm_cents,   tp.price_per_sqm_cents),
      currency              = COALESCE(NULLIF(NEW.currency, ''),  tp.currency),
      category              = COALESCE(NULLIF(NEW.category, ''),  tp.category),
      lead_time             = NULLIF(NEW.lead_time, ''),
      dimensions            = NULLIF(NEW.dimensions, ''),
      materials             = NULLIF(NEW.materials, ''),
      description           = NULLIF(NEW.description, ''),
      meta_description      = NULLIF(NEW.meta_description, ''),
      image_url             = NULLIF(NEW.image_url, ''),
      subcategory           = NULLIF(NEW.subcategory, ''),
      origin                = NULLIF(NEW.origin, ''),
      price_prefix          = NULLIF(NEW.price_prefix, ''),
      gallery_images        = NEW.gallery_images,
      spec_sheet_url        = NULLIF(NEW.pdf_url, ''),
      pdf_urls              = NEW.pdf_urls,
      pack_cbm              = NEW.pack_cbm,
      pack_weight_kg        = NEW.pack_weight_kg,
      pack_carton_count     = NEW.pack_carton_count,
      default_ship_mode     = NULLIF(NEW.default_ship_mode, ''),
      pickup_country        = NULLIF(NEW.pickup_country, ''),
      pickup_postcode       = NULLIF(NEW.pickup_postcode, ''),
      pickup_address        = NULLIF(NEW.pickup_address, ''),
      hs_code               = NULLIF(NEW.hs_code, ''),
      is_upholstered        = NEW.is_upholstered,
      size_variants         = NEW.size_variants,
      variant_image_map     = NEW.variant_image_map,
      base_axis_label       = NULLIF(NEW.base_axis_label, ''),
      top_axis_label        = NULLIF(NEW.top_axis_label, ''),
      variant_placeholder   = NULLIF(NEW.variant_placeholder, ''),
      wood_label_override   = NULLIF(NEW.wood_label_override, ''),
      default_variant_label = NULLIF(NEW.default_variant_label, ''),
      width_mm              = COALESCE(NEW.width_mm,          tp.width_mm),
      depth_mm              = COALESCE(NEW.depth_mm,          tp.depth_mm),
      height_mm             = COALESCE(NEW.height_mm,         tp.height_mm),
      seat_height_mm        = COALESCE(NEW.seat_height_mm,    tp.seat_height_mm),
      is_contract_grade     = NEW.is_contract_grade,
      is_active             = true,
      updated_at            = now()
    WHERE tp.id = _existing_id;
    RETURN NEW;
  END IF;

  _pick_age_sec := EXTRACT(EPOCH FROM (now() - NEW.created_at));
  IF char_length(btrim(NEW.title)) < 6
     OR NULLIF(btrim(COALESCE(NEW.image_url, '')), '') IS NULL
     OR _pick_age_sec < 5 THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.trade_products (
    brand_name, product_name, category, subcategory,
    trade_price_cents, rrp_price_cents, price_per_sqm_cents, currency,
    dimensions, materials, description, meta_description,
    lead_time, image_url, gallery_images,
    spec_sheet_url, pdf_urls, origin, price_prefix,
    pack_cbm, pack_weight_kg, pack_carton_count,
    default_ship_mode, pickup_country, pickup_postcode, pickup_address,
    hs_code, is_upholstered,
    size_variants, variant_image_map,
    base_axis_label, top_axis_label, variant_placeholder, wood_label_override,
    default_variant_label,
    width_mm, depth_mm, height_mm, seat_height_mm, is_contract_grade,
    is_active, source_pick_id
  )
  VALUES (
    _brand_name, NEW.title,
    COALESCE(NULLIF(NEW.category,''), 'Other'),
    NULLIF(NEW.subcategory,''),
    NEW.trade_price_cents, _rrp_cents, NEW.price_per_sqm_cents,
    COALESCE(NULLIF(NEW.currency,''), 'EUR'),
    NULLIF(NEW.dimensions,''), NULLIF(NEW.materials,''), NULLIF(NEW.description,''), NULLIF(NEW.meta_description,''),
    NULLIF(NEW.lead_time,''), NULLIF(NEW.image_url,''), NEW.gallery_images,
    NULLIF(NEW.pdf_url,''), NEW.pdf_urls, NULLIF(NEW.origin,''), NULLIF(NEW.price_prefix,''),
    NEW.pack_cbm, NEW.pack_weight_kg, NEW.pack_carton_count,
    NULLIF(NEW.default_ship_mode,''), NULLIF(NEW.pickup_country,''),
    NULLIF(NEW.pickup_postcode,''), NULLIF(NEW.pickup_address,''),
    NULLIF(NEW.hs_code,''), NEW.is_upholstered,
    NEW.size_variants, NEW.variant_image_map,
    NULLIF(NEW.base_axis_label,''), NULLIF(NEW.top_axis_label,''),
    NULLIF(NEW.variant_placeholder,''), NULLIF(NEW.wood_label_override,''),
    NULLIF(NEW.default_variant_label,''),
    NEW.width_mm, NEW.depth_mm, NEW.height_mm, NEW.seat_height_mm, NEW.is_contract_grade,
    true, NEW.id
  );
  RETURN NEW;
END;
$function$;

-- ── Re-arm both mirrors so an edit to the default alone propagates ──────────
DROP TRIGGER IF EXISTS trg_sync_designer_curator_picks_public ON public.designer_curator_picks;
CREATE TRIGGER trg_sync_designer_curator_picks_public
  AFTER INSERT OR DELETE OR UPDATE OF title, subtitle, designer_id, category, subcategory, tags,
    materials, dimensions, description, edition, photo_credit, pdf_url, pdf_filename, pdf_urls,
    sort_order, currency, lead_time, price_prefix, gallery_images, origin, size_variants,
    variant_placeholder, base_axis_label, top_axis_label, variant_image_map, is_hidden, trade_only,
    edition_number, edition_signing, default_ship_mode, materials_description, gallery_captions,
    is_upholstered, wood_label_override, image_url, hover_image_url, allow_com_col, slug,
    default_variant_label
  ON public.designer_curator_picks
  FOR EACH ROW EXECUTE FUNCTION public.sync_designer_curator_picks_public();

DROP TRIGGER IF EXISTS trg_sync_curator_pick_to_trade_product ON public.designer_curator_picks;
CREATE TRIGGER trg_sync_curator_pick_to_trade_product
  AFTER INSERT OR UPDATE OF title, subtitle, designer_id, category, subcategory, materials,
    dimensions, description, meta_description, pdf_url, pdf_urls, currency, lead_time, price_prefix,
    gallery_images, origin, size_variants, variant_placeholder, base_axis_label, top_axis_label,
    variant_image_map, is_hidden, trade_price_cents, price_per_sqm_cents, pack_cbm, pack_weight_kg,
    pack_carton_count, default_ship_mode, pickup_country, pickup_postcode, pickup_address, hs_code,
    is_upholstered, wood_label_override, image_url, hover_image_url, width_mm, depth_mm, height_mm,
    seat_height_mm, is_contract_grade, default_variant_label
  ON public.designer_curator_picks
  FOR EACH ROW EXECUTE FUNCTION public.sync_curator_pick_to_trade_product();
