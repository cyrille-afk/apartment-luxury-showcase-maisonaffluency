-- 1. Add per-sqm rate to curator picks and trade products (rugs use it; nullable elsewhere).
ALTER TABLE public.designer_curator_picks
  ADD COLUMN IF NOT EXISTS price_per_sqm_cents integer;

ALTER TABLE public.trade_products
  ADD COLUMN IF NOT EXISTS price_per_sqm_cents integer;

COMMENT ON COLUMN public.designer_curator_picks.price_per_sqm_cents IS
  'Per-square-metre price in minor units (e.g. EUR cents). When set, rug variant prices and custom-size quotes are calculated from W × L parsed from the variant label.';
COMMENT ON COLUMN public.trade_products.price_per_sqm_cents IS
  'Mirrored from designer_curator_picks via sync trigger. See column comment on the picks table.';

-- 2. Update the sync trigger to also mirror price_per_sqm_cents (COALESCE so we never wipe).
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
      updated_at            = now()
    WHERE tp.id = _existing_id;
  ELSE
    INSERT INTO public.trade_products (
      brand_name, product_name, category, subcategory,
      trade_price_cents, rrp_price_cents, price_per_sqm_cents, currency,
      dimensions, materials, description,
      lead_time, image_url, gallery_images,
      spec_sheet_url, origin, price_prefix,
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
      true
    );
  END IF;

  RETURN NEW;
END;
$function$;