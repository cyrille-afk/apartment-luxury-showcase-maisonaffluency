-- 1) Add packing + pickup columns to both tables

ALTER TABLE public.designer_curator_picks
  ADD COLUMN IF NOT EXISTS pack_cbm           numeric(8,3),
  ADD COLUMN IF NOT EXISTS pack_weight_kg     numeric(10,2),
  ADD COLUMN IF NOT EXISTS pack_carton_count  integer,
  ADD COLUMN IF NOT EXISTS default_ship_mode  text,
  ADD COLUMN IF NOT EXISTS pickup_country     text,
  ADD COLUMN IF NOT EXISTS pickup_postcode    text,
  ADD COLUMN IF NOT EXISTS pickup_address     text;

ALTER TABLE public.trade_products
  ADD COLUMN IF NOT EXISTS pack_cbm           numeric(8,3),
  ADD COLUMN IF NOT EXISTS pack_weight_kg     numeric(10,2),
  ADD COLUMN IF NOT EXISTS pack_carton_count  integer,
  ADD COLUMN IF NOT EXISTS default_ship_mode  text,
  ADD COLUMN IF NOT EXISTS pickup_country     text,
  ADD COLUMN IF NOT EXISTS pickup_postcode    text,
  ADD COLUMN IF NOT EXISTS pickup_address     text;

-- 2) Constrain ship_mode + pickup_country shape (NULL allowed)

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'designer_curator_picks_default_ship_mode_check') THEN
    ALTER TABLE public.designer_curator_picks
      ADD CONSTRAINT designer_curator_picks_default_ship_mode_check
      CHECK (default_ship_mode IS NULL OR default_ship_mode IN ('sea_lcl','sea_fcl','air','road','courier'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'trade_products_default_ship_mode_check') THEN
    ALTER TABLE public.trade_products
      ADD CONSTRAINT trade_products_default_ship_mode_check
      CHECK (default_ship_mode IS NULL OR default_ship_mode IN ('sea_lcl','sea_fcl','air','road','courier'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'designer_curator_picks_pickup_country_iso2_check') THEN
    ALTER TABLE public.designer_curator_picks
      ADD CONSTRAINT designer_curator_picks_pickup_country_iso2_check
      CHECK (pickup_country IS NULL OR pickup_country ~ '^[A-Z]{2}$');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'trade_products_pickup_country_iso2_check') THEN
    ALTER TABLE public.trade_products
      ADD CONSTRAINT trade_products_pickup_country_iso2_check
      CHECK (pickup_country IS NULL OR pickup_country ~ '^[A-Z]{2}$');
  END IF;
END $$;

-- 3) Update the curator-pick → trade_product sync trigger to mirror the new fields (COALESCE-only)

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
BEGIN
  SELECT name INTO _brand_name FROM public.designers WHERE id = NEW.designer_id;
  IF _brand_name IS NULL OR NEW.title IS NULL OR btrim(NEW.title) = '' THEN
    RETURN NEW;
  END IF;

  _rrp_cents := NEW.trade_price_cents;

  SELECT id INTO _existing_id
  FROM public.trade_products
  WHERE brand_name = _brand_name
    AND product_name = NEW.title
  LIMIT 1;

  IF _existing_id IS NOT NULL THEN
    UPDATE public.trade_products tp
    SET
      trade_price_cents     = COALESCE(NEW.trade_price_cents,     tp.trade_price_cents),
      rrp_price_cents       = COALESCE(_rrp_cents,                tp.rrp_price_cents),
      price_per_sqm_cents   = COALESCE(NEW.price_per_sqm_cents,   tp.price_per_sqm_cents),
      currency              = COALESCE(NULLIF(NEW.currency, ''),  tp.currency),
      lead_time             = COALESCE(NULLIF(NEW.lead_time, ''), tp.lead_time),
      dimensions            = COALESCE(NULLIF(NEW.dimensions, ''),tp.dimensions),
      materials             = COALESCE(NULLIF(NEW.materials, ''), tp.materials),
      description           = COALESCE(NULLIF(NEW.description, ''),tp.description),
      image_url             = COALESCE(NULLIF(NEW.image_url, ''), tp.image_url),
      category              = COALESCE(NULLIF(NEW.category, ''),  tp.category),
      subcategory           = COALESCE(NULLIF(NEW.subcategory, ''),tp.subcategory),
      origin                = COALESCE(NULLIF(NEW.origin, ''),    tp.origin),
      price_prefix          = COALESCE(NULLIF(NEW.price_prefix, ''),tp.price_prefix),
      gallery_images        = COALESCE(NEW.gallery_images,        tp.gallery_images),
      spec_sheet_url        = COALESCE(NULLIF(NEW.pdf_url, ''),   tp.spec_sheet_url),
      pack_cbm              = COALESCE(NEW.pack_cbm,              tp.pack_cbm),
      pack_weight_kg        = COALESCE(NEW.pack_weight_kg,        tp.pack_weight_kg),
      pack_carton_count     = COALESCE(NEW.pack_carton_count,     tp.pack_carton_count),
      default_ship_mode     = COALESCE(NULLIF(NEW.default_ship_mode, ''), tp.default_ship_mode),
      pickup_country        = COALESCE(NULLIF(NEW.pickup_country, ''),    tp.pickup_country),
      pickup_postcode       = COALESCE(NULLIF(NEW.pickup_postcode, ''),   tp.pickup_postcode),
      pickup_address        = COALESCE(NULLIF(NEW.pickup_address, ''),    tp.pickup_address),
      updated_at            = now()
    WHERE tp.id = _existing_id;
  ELSE
    INSERT INTO public.trade_products (
      brand_name, product_name, category, subcategory,
      trade_price_cents, rrp_price_cents, price_per_sqm_cents, currency,
      dimensions, materials, description,
      lead_time, image_url, gallery_images,
      spec_sheet_url, origin, price_prefix,
      pack_cbm, pack_weight_kg, pack_carton_count,
      default_ship_mode, pickup_country, pickup_postcode, pickup_address,
      is_active
    )
    VALUES (
      _brand_name, NEW.title,
      COALESCE(NULLIF(NEW.category, ''), 'Uncategorized'),
      NEW.subcategory,
      NEW.trade_price_cents, _rrp_cents, NEW.price_per_sqm_cents,
      COALESCE(NULLIF(NEW.currency, ''), 'EUR'),
      NEW.dimensions, NEW.materials, NEW.description,
      NEW.lead_time, NEW.image_url, NEW.gallery_images,
      NEW.pdf_url, NEW.origin, NEW.price_prefix,
      NEW.pack_cbm, NEW.pack_weight_kg, NEW.pack_carton_count,
      NULLIF(NEW.default_ship_mode, ''), NULLIF(NEW.pickup_country, ''),
      NULLIF(NEW.pickup_postcode, ''), NULLIF(NEW.pickup_address, ''),
      true
    );
  END IF;

  RETURN NEW;
END;
$function$;