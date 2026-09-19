DROP VIEW IF EXISTS public.product_fabric_swatches_public;

CREATE TABLE public.product_fabric_swatches_public (
  pick_id uuid NOT NULL,
  fabric_id uuid NOT NULL,
  sort_order integer,
  price_tier_label text,
  name text NOT NULL,
  image_url text,
  category text,
  supplier text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  PRIMARY KEY (pick_id, fabric_id)
);

GRANT SELECT ON public.product_fabric_swatches_public TO anon;
GRANT SELECT ON public.product_fabric_swatches_public TO authenticated;
GRANT ALL ON public.product_fabric_swatches_public TO service_role;

ALTER TABLE public.product_fabric_swatches_public ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can read active fabric swatches only"
ON public.product_fabric_swatches_public
FOR SELECT
TO anon, authenticated
USING (is_active = true);

CREATE OR REPLACE FUNCTION public.refresh_product_fabric_swatches_public()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  TRUNCATE TABLE public.product_fabric_swatches_public;

  INSERT INTO public.product_fabric_swatches_public (
    pick_id,
    fabric_id,
    sort_order,
    price_tier_label,
    name,
    image_url,
    category,
    supplier,
    is_active,
    updated_at
  )
  SELECT
    pf.pick_id,
    pf.fabric_id,
    pf.sort_order,
    pf.price_tier_label,
    f.name,
    f.image_url,
    f.category,
    f.supplier,
    f.is_active,
    now()
  FROM public.product_fabrics pf
  JOIN public.fabrics f ON f.id = pf.fabric_id
  WHERE f.is_active = true;

  RETURN NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.refresh_product_fabric_swatches_public() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.refresh_product_fabric_swatches_public() FROM anon;
REVOKE ALL ON FUNCTION public.refresh_product_fabric_swatches_public() FROM authenticated;
GRANT EXECUTE ON FUNCTION public.refresh_product_fabric_swatches_public() TO service_role;

INSERT INTO public.product_fabric_swatches_public (
  pick_id,
  fabric_id,
  sort_order,
  price_tier_label,
  name,
  image_url,
  category,
  supplier,
  is_active,
  updated_at
)
SELECT
  pf.pick_id,
  pf.fabric_id,
  pf.sort_order,
  pf.price_tier_label,
  f.name,
  f.image_url,
  f.category,
  f.supplier,
  f.is_active,
  now()
FROM public.product_fabrics pf
JOIN public.fabrics f ON f.id = pf.fabric_id
WHERE f.is_active = true;

DROP TRIGGER IF EXISTS refresh_product_fabric_swatches_public_from_links ON public.product_fabrics;
CREATE TRIGGER refresh_product_fabric_swatches_public_from_links
AFTER INSERT OR UPDATE OR DELETE OR TRUNCATE ON public.product_fabrics
FOR EACH STATEMENT
EXECUTE FUNCTION public.refresh_product_fabric_swatches_public();

DROP TRIGGER IF EXISTS refresh_product_fabric_swatches_public_from_fabrics ON public.fabrics;
CREATE TRIGGER refresh_product_fabric_swatches_public_from_fabrics
AFTER INSERT OR UPDATE OR DELETE OR TRUNCATE ON public.fabrics
FOR EACH STATEMENT
EXECUTE FUNCTION public.refresh_product_fabric_swatches_public();