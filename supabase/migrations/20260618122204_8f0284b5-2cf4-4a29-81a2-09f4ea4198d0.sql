
-- 1. Add pdf_urls column to trade_products (mirrors designer_curator_picks.pdf_urls)
ALTER TABLE public.trade_products
  ADD COLUMN IF NOT EXISTS pdf_urls jsonb;

-- 2. Update sync trigger to mirror pdf_urls (alongside the existing spec_sheet_url)
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
    dimensions, materials, description,
    lead_time, image_url, gallery_images,
    spec_sheet_url, pdf_urls, origin, price_prefix,
    pack_cbm, pack_weight_kg, pack_carton_count,
    default_ship_mode, pickup_country, pickup_postcode, pickup_address,
    hs_code, is_upholstered,
    size_variants, variant_image_map,
    base_axis_label, top_axis_label, variant_placeholder, wood_label_override,
    is_active, source_pick_id
  )
  VALUES (
    _brand_name, NEW.title,
    COALESCE(NULLIF(NEW.category,''), 'Other'),
    NULLIF(NEW.subcategory,''),
    NEW.trade_price_cents, _rrp_cents, NEW.price_per_sqm_cents,
    COALESCE(NULLIF(NEW.currency,''), 'EUR'),
    NULLIF(NEW.dimensions,''), NULLIF(NEW.materials,''), NULLIF(NEW.description,''),
    NULLIF(NEW.lead_time,''), NULLIF(NEW.image_url,''), NEW.gallery_images,
    NULLIF(NEW.pdf_url,''), NEW.pdf_urls, NULLIF(NEW.origin,''), NULLIF(NEW.price_prefix,''),
    NEW.pack_cbm, NEW.pack_weight_kg, NEW.pack_carton_count,
    NULLIF(NEW.default_ship_mode,''), NULLIF(NEW.pickup_country,''),
    NULLIF(NEW.pickup_postcode,''), NULLIF(NEW.pickup_address,''),
    NULLIF(NEW.hs_code,''), NEW.is_upholstered,
    NEW.size_variants, NEW.variant_image_map,
    NULLIF(NEW.base_axis_label,''), NULLIF(NEW.top_axis_label,''),
    NULLIF(NEW.variant_placeholder,''), NULLIF(NEW.wood_label_override,''),
    true, NEW.id
  );

  RETURN NEW;
END;
$function$;

-- 3. Backfill: copy pdf_urls from each pick into its linked twin
UPDATE public.trade_products tp
SET pdf_urls = p.pdf_urls,
    updated_at = now()
FROM public.designer_curator_picks p
WHERE tp.source_pick_id = p.id
  AND tp.pdf_urls IS DISTINCT FROM p.pdf_urls;
