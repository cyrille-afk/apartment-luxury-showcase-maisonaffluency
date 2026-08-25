CREATE OR REPLACE FUNCTION public.is_public_sitemap_product(_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.trade_products tp
    WHERE tp.id = _id
      AND tp.is_active IS TRUE
      AND COALESCE(tp.is_hidden, false) IS FALSE
  )
$$;

REVOKE ALL ON FUNCTION public.is_public_sitemap_product(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_public_sitemap_product(uuid) TO anon, authenticated;

DROP POLICY IF EXISTS "Public can view sitemap URLs for public products" ON public.sitemap_products;
CREATE POLICY "Public can view sitemap URLs for public products"
ON public.sitemap_products
FOR SELECT
TO anon, authenticated
USING (public.is_public_sitemap_product(id));