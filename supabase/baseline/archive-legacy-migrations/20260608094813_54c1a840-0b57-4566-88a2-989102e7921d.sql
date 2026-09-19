
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
  WHERE brand_name = _brand_name AND product_name = NEW.title
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
    IF char_length(btrim(NEW.title)) < 4 OR NULLIF(btrim(COALESCE(NEW.image_url, '')), '') IS NULL THEN
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

UPDATE public.client_board_items
SET product_id = '880e3ae6-50df-4332-87b9-da822cb66d56'
WHERE id = '6da3b28b-0bb7-4d77-8885-5931d24e25ef';

WITH stubs AS (
  SELECT tp.id
  FROM public.trade_products tp
  WHERE NULLIF(btrim(COALESCE(tp.image_url, '')), '') IS NULL
    AND tp.trade_price_cents IS NULL
    AND tp.rrp_price_cents IS NULL
    AND (
      char_length(btrim(tp.product_name)) < 4
      OR EXISTS (
        SELECT 1 FROM public.trade_products sib
        WHERE sib.brand_name = tp.brand_name
          AND sib.id <> tp.id
          AND char_length(sib.product_name) > char_length(tp.product_name)
          AND sib.image_url IS NOT NULL
          AND lower(sib.product_name) LIKE lower(tp.product_name) || '%'
      )
    )
),
referenced AS (
  SELECT s.id FROM stubs s
  WHERE EXISTS (SELECT 1 FROM public.client_board_items x WHERE x.product_id = s.id)
     OR EXISTS (SELECT 1 FROM public.trade_quote_items x WHERE x.product_id = s.id)
     OR EXISTS (SELECT 1 FROM public.trade_favorites x WHERE x.product_id = s.id)
     OR EXISTS (SELECT 1 FROM public.trade_recent_views x WHERE x.entity_type = 'product' AND x.entity_id = s.id)
),
deactivated AS (
  UPDATE public.trade_products tp
  SET is_active = false, updated_at = now()
  WHERE tp.id IN (SELECT id FROM referenced)
  RETURNING tp.id
)
DELETE FROM public.trade_products tp
WHERE tp.id IN (SELECT id FROM stubs)
  AND tp.id NOT IN (SELECT id FROM referenced);
