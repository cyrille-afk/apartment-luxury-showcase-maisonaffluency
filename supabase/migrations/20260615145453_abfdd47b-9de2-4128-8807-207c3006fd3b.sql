ALTER TABLE public.product_fabrics
  ADD COLUMN IF NOT EXISTS image_indices integer[] DEFAULT NULL;
COMMENT ON COLUMN public.product_fabrics.image_indices IS
  '1-based gallery image indices that depict this swatch on the linked product. Drives gallery auto-jump.';

ALTER TABLE public.product_fabric_swatches_public
  ADD COLUMN IF NOT EXISTS image_indices integer[] DEFAULT NULL;

CREATE OR REPLACE FUNCTION public.refresh_product_fabric_swatches_public()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  TRUNCATE TABLE public.product_fabric_swatches_public;

  INSERT INTO public.product_fabric_swatches_public (
    pick_id, fabric_id, sort_order, price_tier_label, image_indices,
    name, image_url, category, supplier, is_active, updated_at
  )
  SELECT
    pf.pick_id, pf.fabric_id, pf.sort_order, pf.price_tier_label, pf.image_indices,
    f.name, f.image_url, f.category, f.supplier, f.is_active, now()
  FROM public.product_fabrics pf
  JOIN public.fabrics f ON f.id = pf.fabric_id
  WHERE f.is_active = true;

  RETURN NULL;
END;
$function$;

-- Refresh the snapshot by re-running the function body once.
DO $$ BEGIN
  TRUNCATE TABLE public.product_fabric_swatches_public;
  INSERT INTO public.product_fabric_swatches_public (
    pick_id, fabric_id, sort_order, price_tier_label, image_indices,
    name, image_url, category, supplier, is_active, updated_at
  )
  SELECT
    pf.pick_id, pf.fabric_id, pf.sort_order, pf.price_tier_label, pf.image_indices,
    f.name, f.image_url, f.category, f.supplier, f.is_active, now()
  FROM public.product_fabrics pf
  JOIN public.fabrics f ON f.id = pf.fabric_id
  WHERE f.is_active = true;
END $$;