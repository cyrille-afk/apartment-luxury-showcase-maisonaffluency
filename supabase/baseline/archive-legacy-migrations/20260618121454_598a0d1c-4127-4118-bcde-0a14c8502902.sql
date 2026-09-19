
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
      -- Prices: keep COALESCE (manual overrides allowed)
      trade_price_cents     = COALESCE(NEW.trade_price_cents,     tp.trade_price_cents),
      rrp_price_cents       = COALESCE(_rrp_cents,                tp.rrp_price_cents),
      price_per_sqm_cents   = COALESCE(NEW.price_per_sqm_cents,   tp.price_per_sqm_cents),
      -- NOT NULL columns: keep fallback to current value
      currency              = COALESCE(NULLIF(NEW.currency, ''),  tp.currency),
      category              = COALESCE(NULLIF(NEW.category, ''),  tp.category),
      -- All other text fields: pick is source of truth; clears propagate as NULL
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
    spec_sheet_url, origin, price_prefix,
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
    NULLIF(NEW.pdf_url,''), NULLIF(NEW.origin,''), NULLIF(NEW.price_prefix,''),
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

-- Backfill drifted twins. NOT NULL columns (category, currency) only updated
-- when the pick has a non-empty value.
UPDATE public.trade_products tp
SET
  dimensions            = NULLIF(p.dimensions, ''),
  materials             = NULLIF(p.materials, ''),
  description           = NULLIF(p.description, ''),
  lead_time             = NULLIF(p.lead_time, ''),
  subcategory           = NULLIF(p.subcategory, ''),
  origin                = NULLIF(p.origin, ''),
  price_prefix          = NULLIF(p.price_prefix, ''),
  image_url             = NULLIF(p.image_url, ''),
  spec_sheet_url        = NULLIF(p.pdf_url, ''),
  default_ship_mode     = NULLIF(p.default_ship_mode, ''),
  pickup_country        = NULLIF(p.pickup_country, ''),
  pickup_postcode       = NULLIF(p.pickup_postcode, ''),
  pickup_address        = NULLIF(p.pickup_address, ''),
  hs_code               = NULLIF(p.hs_code, ''),
  base_axis_label       = NULLIF(p.base_axis_label, ''),
  top_axis_label        = NULLIF(p.top_axis_label, ''),
  variant_placeholder   = NULLIF(p.variant_placeholder, ''),
  wood_label_override   = NULLIF(p.wood_label_override, ''),
  category              = COALESCE(NULLIF(p.category, ''), tp.category),
  currency              = COALESCE(NULLIF(p.currency, ''), tp.currency),
  updated_at            = now()
FROM public.designer_curator_picks p
WHERE tp.source_pick_id = p.id
  AND (
       tp.dimensions          IS DISTINCT FROM NULLIF(p.dimensions, '')
    OR tp.materials           IS DISTINCT FROM NULLIF(p.materials, '')
    OR tp.description         IS DISTINCT FROM NULLIF(p.description, '')
    OR tp.lead_time           IS DISTINCT FROM NULLIF(p.lead_time, '')
    OR tp.subcategory         IS DISTINCT FROM NULLIF(p.subcategory, '')
    OR tp.origin              IS DISTINCT FROM NULLIF(p.origin, '')
    OR tp.price_prefix        IS DISTINCT FROM NULLIF(p.price_prefix, '')
    OR tp.image_url           IS DISTINCT FROM NULLIF(p.image_url, '')
    OR tp.spec_sheet_url      IS DISTINCT FROM NULLIF(p.pdf_url, '')
    OR tp.default_ship_mode   IS DISTINCT FROM NULLIF(p.default_ship_mode, '')
    OR tp.pickup_country      IS DISTINCT FROM NULLIF(p.pickup_country, '')
    OR tp.pickup_postcode     IS DISTINCT FROM NULLIF(p.pickup_postcode, '')
    OR tp.pickup_address      IS DISTINCT FROM NULLIF(p.pickup_address, '')
    OR tp.hs_code             IS DISTINCT FROM NULLIF(p.hs_code, '')
    OR tp.base_axis_label     IS DISTINCT FROM NULLIF(p.base_axis_label, '')
    OR tp.top_axis_label      IS DISTINCT FROM NULLIF(p.top_axis_label, '')
    OR tp.variant_placeholder IS DISTINCT FROM NULLIF(p.variant_placeholder, '')
    OR tp.wood_label_override IS DISTINCT FROM NULLIF(p.wood_label_override, '')
  );
