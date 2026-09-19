DROP FUNCTION IF EXISTS public.public_sitemap_products();

CREATE TABLE IF NOT EXISTS public.sitemap_products (
  id uuid PRIMARY KEY,
  updated_at timestamp with time zone
);

ALTER TABLE public.sitemap_products ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view sitemap product URLs" ON public.sitemap_products;
CREATE POLICY "Anyone can view sitemap product URLs"
ON public.sitemap_products
FOR SELECT
USING (true);

REVOKE ALL ON public.sitemap_products FROM PUBLIC;
GRANT SELECT ON public.sitemap_products TO anon, authenticated;

INSERT INTO public.sitemap_products (id, updated_at)
SELECT tp.id, tp.updated_at
FROM public.trade_products tp
WHERE tp.is_active IS TRUE
  AND COALESCE(tp.is_hidden, false) IS FALSE
ON CONFLICT (id) DO UPDATE
SET updated_at = EXCLUDED.updated_at;

DELETE FROM public.sitemap_products sp
WHERE NOT EXISTS (
  SELECT 1
  FROM public.trade_products tp
  WHERE tp.id = sp.id
    AND tp.is_active IS TRUE
    AND COALESCE(tp.is_hidden, false) IS FALSE
);

CREATE OR REPLACE FUNCTION public.sync_sitemap_product()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    DELETE FROM public.sitemap_products WHERE id = OLD.id;
    RETURN OLD;
  END IF;

  IF NEW.is_active IS TRUE AND COALESCE(NEW.is_hidden, false) IS FALSE THEN
    INSERT INTO public.sitemap_products (id, updated_at)
    VALUES (NEW.id, NEW.updated_at)
    ON CONFLICT (id) DO UPDATE
    SET updated_at = EXCLUDED.updated_at;
  ELSE
    DELETE FROM public.sitemap_products WHERE id = NEW.id;
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.sync_sitemap_product() FROM PUBLIC;

DROP TRIGGER IF EXISTS sync_sitemap_product_on_trade_products ON public.trade_products;
CREATE TRIGGER sync_sitemap_product_on_trade_products
AFTER INSERT OR UPDATE OF is_active, is_hidden, updated_at OR DELETE
ON public.trade_products
FOR EACH ROW
EXECUTE FUNCTION public.sync_sitemap_product();