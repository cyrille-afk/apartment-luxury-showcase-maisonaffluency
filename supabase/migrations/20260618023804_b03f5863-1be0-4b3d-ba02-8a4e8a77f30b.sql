-- Fix curator pick → trade product mirroring so streamed title edits no
-- longer create dozens of partial duplicate trade_products rows.
--
-- 1. Add a stable source_pick_id link so renaming a pick UPDATEs the same
--    trade_products row instead of inserting a new one keyed on (brand,name).
-- 2. Cascade DELETE so removing a curator pick removes its mirror row.
-- 3. Rewrite the sync trigger to prefer the source_pick_id match, fall back
--    to (brand,name), and tighten the insert guard (title must be >= 6 chars
--    and the pick must be at least 5 seconds old — stops mid-stream inserts).

ALTER TABLE public.trade_products
  ADD COLUMN IF NOT EXISTS source_pick_id uuid
  REFERENCES public.designer_curator_picks(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS trade_products_source_pick_id_idx
  ON public.trade_products(source_pick_id);

-- Backfill where the existing (brand,name) match is unambiguous.
UPDATE public.trade_products tp
SET source_pick_id = p.id
FROM public.designer_curator_picks p
JOIN public.designers d ON d.id = p.designer_id
WHERE tp.source_pick_id IS NULL
  AND tp.brand_name = d.name
  AND tp.product_name = p.title;

CREATE OR REPLACE FUNCTION public.sync_curator_pick_to_trade_product()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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

  -- Prefer the stable source_pick_id link.
  SELECT id INTO _existing_id
  FROM public.trade_products
  WHERE source_pick_id = NEW.id
  LIMIT 1;

  -- Fall back to (brand,name) for legacy rows without a source link.
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
      hs_code               = COALESCE(NULLIF(NEW.hs_code, ''),    tp.hs_code),
      is_upholstered        = COALESCE(NEW.is_upholstered,        tp.is_upholstered),
      updated_at            = now()
    WHERE tp.id = _existing_id;
    RETURN NEW;
  END IF;

  -- No existing row. Refuse to INSERT for pick rows that look like in-flight
  -- streamed edits (short title, no image, or pick just created).
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
    is_active, source_pick_id
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
    NULLIF(NEW.hs_code, ''), NEW.is_upholstered,
    true, NEW.id
  );

  RETURN NEW;
END;
$$;
