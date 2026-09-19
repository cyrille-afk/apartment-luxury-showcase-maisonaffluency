
-- 1. New auth-only pricing table keyed by pick id
CREATE TABLE public.trade_product_pricing (
  pick_id uuid PRIMARY KEY REFERENCES public.designer_curator_picks(id) ON DELETE CASCADE,
  trade_price_cents integer,
  price_per_sqm_cents integer,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid
);

-- 2. Grants: no anon access at all
GRANT SELECT ON public.trade_product_pricing TO authenticated;
GRANT ALL ON public.trade_product_pricing TO service_role;

-- 3. RLS
ALTER TABLE public.trade_product_pricing ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read trade pricing"
  ON public.trade_product_pricing FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Admins manage trade pricing"
  ON public.trade_product_pricing FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- 4. updated_at trigger
CREATE TRIGGER tg_trade_product_pricing_updated_at
  BEFORE UPDATE ON public.trade_product_pricing
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- 5. Backfill from existing columns
INSERT INTO public.trade_product_pricing (pick_id, trade_price_cents, price_per_sqm_cents)
SELECT id, trade_price_cents, price_per_sqm_cents
FROM public.designer_curator_picks
WHERE trade_price_cents IS NOT NULL OR price_per_sqm_cents IS NOT NULL
ON CONFLICT (pick_id) DO NOTHING;

-- 6. Keep base columns in sync from new table (so legacy code still works during the migration phase).
--    Writes to pricing table mirror back to the base table columns.
CREATE OR REPLACE FUNCTION public.tg_mirror_pricing_to_pick()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.designer_curator_picks
     SET trade_price_cents   = NEW.trade_price_cents,
         price_per_sqm_cents = NEW.price_per_sqm_cents
   WHERE id = NEW.pick_id;
  RETURN NEW;
END;
$$;

CREATE TRIGGER tg_trade_product_pricing_mirror
  AFTER INSERT OR UPDATE ON public.trade_product_pricing
  FOR EACH ROW EXECUTE FUNCTION public.tg_mirror_pricing_to_pick();

-- 7. LOCK DOWN the API surface: revoke anon SELECT on the whole table, then re-grant
--    SELECT only on non-pricing columns. This stops anonymous REST clients from reading
--    trade_price_cents / price_per_sqm_cents while leaving authenticated reads intact.
REVOKE SELECT ON public.designer_curator_picks FROM anon;

GRANT SELECT (
  id, designer_id, image_url, hover_image_url, title, subtitle,
  category, subcategory, tags, materials, dimensions, description,
  edition, photo_credit, pdf_url, pdf_filename, pdf_urls, sort_order,
  created_at, currency, lead_time, price_prefix, gallery_images, origin,
  size_variants, variant_placeholder, base_axis_label, top_axis_label,
  variant_image_map, is_hidden, edition_number, edition_signing,
  pack_cbm, pack_weight_kg, pack_carton_count, default_ship_mode,
  pickup_country, pickup_postcode, pickup_address, materials_description
) ON public.designer_curator_picks TO anon;
