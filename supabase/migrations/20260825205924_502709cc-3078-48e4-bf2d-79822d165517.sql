CREATE OR REPLACE FUNCTION public.match_trade_products(
  query_embedding vector,
  match_threshold float,
  match_count int
)
RETURNS TABLE (
  id uuid,
  product_name text,
  brand_name text,
  category text,
  subcategory text,
  description text,
  materials text,
  dimensions text,
  trade_price_cents integer,
  currency text,
  image_url text,
  designer_id uuid,
  designer_name text,
  designer_slug text,
  designer_country text,
  similarity double precision
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path TO 'public'
AS $$
  SELECT
    t.id,
    t.product_name,
    t.brand_name,
    t.category,
    t.subcategory,
    t.description,
    t.materials,
    t.dimensions,
    t.trade_price_cents,
    t.currency,
    t.image_url,
    d.id AS designer_id,
    COALESCE(d.display_name, d.name) AS designer_name,
    d.slug AS designer_slug,
    d.country AS designer_country,
    1 - (t.embedding <=> query_embedding) AS similarity
  FROM public.trade_products t
  LEFT JOIN public.designer_curator_picks p ON p.id = t.source_pick_id
  LEFT JOIN public.designers d ON d.id = p.designer_id
  WHERE t.embedding IS NOT NULL
    AND t.is_active = true
    AND 1 - (t.embedding <=> query_embedding) >= match_threshold
  ORDER BY t.embedding <=> query_embedding ASC
  LIMIT match_count;
$$;

GRANT EXECUTE ON FUNCTION public.match_trade_products(vector, float, int) TO authenticated;
GRANT EXECUTE ON FUNCTION public.match_trade_products(vector, float, int) TO service_role;