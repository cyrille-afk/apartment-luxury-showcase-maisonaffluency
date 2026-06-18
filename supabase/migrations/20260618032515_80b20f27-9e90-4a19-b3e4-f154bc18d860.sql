
-- ─────────────────────────────────────────────────────────────
-- #4 Replace ON DELETE CASCADE with ON DELETE SET NULL on
-- trade_products.source_pick_id so deleting a curator pick no
-- longer wipes the mirror trade_products row (and every
-- client_board_items / trade_favorites / cad asset / quote line
-- that references it).
-- ─────────────────────────────────────────────────────────────
ALTER TABLE public.trade_products
  DROP CONSTRAINT IF EXISTS trade_products_source_pick_id_fkey;

ALTER TABLE public.trade_products
  ADD CONSTRAINT trade_products_source_pick_id_fkey
  FOREIGN KEY (source_pick_id)
  REFERENCES public.designer_curator_picks(id)
  ON DELETE SET NULL;

-- When a pick is deleted, mark its orphaned mirror inactive so it
-- stops surfacing in catalog queries while staying joinable from
-- existing client-board / quote / favorite rows.
CREATE OR REPLACE FUNCTION public.deactivate_orphaned_trade_product()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.trade_products
  SET is_active = false,
      updated_at = now()
  WHERE source_pick_id = OLD.id;
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trg_deactivate_orphaned_trade_product
  ON public.designer_curator_picks;

CREATE TRIGGER trg_deactivate_orphaned_trade_product
  BEFORE DELETE ON public.designer_curator_picks
  FOR EACH ROW
  EXECUTE FUNCTION public.deactivate_orphaned_trade_product();

-- ─────────────────────────────────────────────────────────────
-- #1 Backfill the 26 visible curator picks that have no mirror
-- row in trade_products. The streaming-edit guard in the sync
-- trigger requires title length >= 6 and pick age >= 5s; those
-- 26 rows already satisfy a saner "complete record" filter
-- (title >= 3 chars, image_url populated, created > 30s ago).
-- ─────────────────────────────────────────────────────────────
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
SELECT
  d.name,
  p.title,
  COALESCE(NULLIF(p.category, ''), 'Uncategorized'),
  p.subcategory,
  p.trade_price_cents,
  p.trade_price_cents,
  p.price_per_sqm_cents,
  COALESCE(NULLIF(p.currency, ''), 'EUR'),
  p.dimensions, p.materials, p.description,
  p.lead_time, p.image_url, p.gallery_images,
  p.pdf_url, p.origin, p.price_prefix,
  p.pack_cbm, p.pack_weight_kg, p.pack_carton_count,
  NULLIF(p.default_ship_mode, ''), NULLIF(p.pickup_country, ''),
  NULLIF(p.pickup_postcode, ''), NULLIF(p.pickup_address, ''),
  NULLIF(p.hs_code, ''), p.is_upholstered,
  true, p.id
FROM public.designer_curator_picks p
JOIN public.designers d ON d.id = p.designer_id
LEFT JOIN public.trade_products tp ON tp.source_pick_id = p.id
WHERE p.is_hidden = false
  AND tp.id IS NULL
  AND char_length(btrim(p.title)) >= 3
  AND COALESCE(NULLIF(btrim(p.image_url), ''), NULL) IS NOT NULL
  AND EXTRACT(EPOCH FROM (now() - p.created_at)) > 30
  -- Avoid colliding with a legacy (brand,name) row that just
  -- never got source_pick_id set; the sync trigger will
  -- re-link those on next pick UPDATE.
  AND NOT EXISTS (
    SELECT 1 FROM public.trade_products tp2
    WHERE tp2.brand_name = d.name
      AND tp2.product_name = p.title
  );
