CREATE OR REPLACE FUNCTION public.public_sitemap_products()
RETURNS TABLE(id uuid, updated_at timestamp with time zone)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT tp.id, tp.updated_at
  FROM public.trade_products tp
  WHERE tp.is_active IS TRUE
    AND COALESCE(tp.is_hidden, false) IS FALSE
  ORDER BY tp.updated_at DESC NULLS LAST, tp.id;
$$;

REVOKE ALL ON FUNCTION public.public_sitemap_products() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.public_sitemap_products() TO anon, authenticated;