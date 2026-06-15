DROP VIEW IF EXISTS public.product_fabric_swatches_public;

CREATE VIEW public.product_fabric_swatches_public
WITH (security_barrier = true, security_invoker = false) AS
SELECT
  pf.pick_id,
  pf.fabric_id,
  pf.sort_order,
  pf.price_tier_label,
  f.name,
  f.image_url,
  f.category,
  f.supplier,
  f.is_active
FROM public.product_fabrics pf
JOIN public.fabrics f ON f.id = pf.fabric_id
WHERE f.is_active = true;

GRANT SELECT ON public.product_fabric_swatches_public TO anon;
GRANT SELECT ON public.product_fabric_swatches_public TO authenticated;
GRANT ALL ON public.product_fabric_swatches_public TO service_role;

REVOKE SELECT ON public.fabrics FROM anon;
REVOKE SELECT ON public.product_fabrics FROM anon;

DROP POLICY IF EXISTS "fabrics public view access (active only)" ON public.fabrics;
DROP POLICY IF EXISTS "Product fabrics are publicly readable" ON public.product_fabrics;

CREATE POLICY "Authenticated users can read product fabrics"
ON public.product_fabrics
FOR SELECT
TO authenticated
USING (true);