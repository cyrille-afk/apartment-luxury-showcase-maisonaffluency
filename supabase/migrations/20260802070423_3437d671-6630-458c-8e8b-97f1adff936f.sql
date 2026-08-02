
CREATE OR REPLACE FUNCTION public.pick_is_publicly_visible(_pick_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.designer_curator_picks p
    JOIN public.designers d ON d.id = p.designer_id
    WHERE p.id = _pick_id
      AND COALESCE(p.is_hidden, false) = false
      AND COALESCE(d.trade_only, false) = false
  )
$$;

CREATE OR REPLACE FUNCTION public.trade_product_is_publicly_visible(_product_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.trade_products t
    WHERE t.id = _product_id
      AND COALESCE(t.is_hidden, false) = false
      AND COALESCE(t.is_active, true) = true
  )
$$;

GRANT EXECUTE ON FUNCTION public.pick_is_publicly_visible(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.trade_product_is_publicly_visible(uuid) TO anon, authenticated;

DROP POLICY IF EXISTS "Public can read active fabric swatches only" ON public.product_fabric_swatches_public;
CREATE POLICY "Public can read active fabric swatches only"
ON public.product_fabric_swatches_public
FOR SELECT
TO anon, authenticated
USING (
  is_active = true
  AND (pick_id IS NULL OR public.pick_is_publicly_visible(pick_id))
);

DROP POLICY IF EXISTS "Public can read product material links" ON public.product_material_links;
CREATE POLICY "Public can read visible product material links"
ON public.product_material_links
FOR SELECT
TO anon, authenticated
USING (
  (pick_id IS NULL OR public.pick_is_publicly_visible(pick_id))
  AND (product_id IS NULL OR public.trade_product_is_publicly_visible(product_id))
);

DROP POLICY IF EXISTS "Public can read product descriptor links" ON public.product_descriptor_links;
CREATE POLICY "Public can read visible product descriptor links"
ON public.product_descriptor_links
FOR SELECT
TO anon, authenticated
USING (
  (pick_id IS NULL OR public.pick_is_publicly_visible(pick_id))
  AND (product_id IS NULL OR public.trade_product_is_publicly_visible(product_id))
);
