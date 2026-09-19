-- 1. Fabrics library
CREATE TABLE public.fabrics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  image_url text,
  category text,              -- 'A' | 'B' | 'C' | 'COM' (Customer's Own) | null
  supplier text,
  sort_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.fabrics TO anon, authenticated;
GRANT ALL ON public.fabrics TO service_role;
ALTER TABLE public.fabrics ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Active fabrics are publicly readable"
  ON public.fabrics FOR SELECT
  USING (is_active = true);
CREATE POLICY "Admins manage fabrics"
  ON public.fabrics FOR ALL
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));
CREATE TRIGGER fabrics_set_updated_at
  BEFORE UPDATE ON public.fabrics
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2. Product ↔ Fabric link
CREATE TABLE public.product_fabrics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pick_id uuid NOT NULL REFERENCES public.designer_curator_picks(id) ON DELETE CASCADE,
  fabric_id uuid NOT NULL REFERENCES public.fabrics(id) ON DELETE CASCADE,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (pick_id, fabric_id)
);
CREATE INDEX product_fabrics_pick_idx ON public.product_fabrics(pick_id);
CREATE INDEX product_fabrics_fabric_idx ON public.product_fabrics(fabric_id);
GRANT SELECT ON public.product_fabrics TO anon, authenticated;
GRANT ALL ON public.product_fabrics TO service_role;
ALTER TABLE public.product_fabrics ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Product fabrics are publicly readable"
  ON public.product_fabrics FOR SELECT
  USING (true);
CREATE POLICY "Admins manage product fabrics"
  ON public.product_fabrics FOR ALL
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- 3. Upholstered override (NULL = auto-detect from category, true/false = manual)
ALTER TABLE public.designer_curator_picks
  ADD COLUMN IF NOT EXISTS is_upholstered boolean;
ALTER TABLE public.trade_products
  ADD COLUMN IF NOT EXISTS is_upholstered boolean;

-- 4. Mirror is_upholstered through the curator-pick → trade-product sync trigger
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
      hs_code               = COALESCE(NULLIF(NEW.hs_code, ''),    tp.hs_code),
      is_upholstered        = COALESCE(NEW.is_upholstered,        tp.is_upholstered),
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
      hs_code, is_upholstered,
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
      NULLIF(NEW.hs_code, ''), NEW.is_upholstered,
      true
    );
  END IF;

  RETURN NEW;
END;
$function$;