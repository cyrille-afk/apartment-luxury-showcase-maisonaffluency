DROP FUNCTION IF EXISTS public.match_catalog(vector, integer);
CREATE OR REPLACE FUNCTION public.match_catalog(query_embedding vector, match_count integer DEFAULT 40)
 RETURNS TABLE(id uuid, source text, title text, designer text, materials text, category text, subcategory text, lead_time text, origin text, default_ship_mode text, currency text, trade_price_cents integer, price_prefix text, stock_status text, dimensions text, similarity double precision)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  WITH picks AS (
    SELECT
      p.id,
      'curator'::text AS source,
      p.title,
      COALESCE(d.display_name, d.name, 'Unknown') AS designer,
      p.materials,
      p.category,
      p.subcategory,
      p.lead_time,
      p.origin,
      p.default_ship_mode,
      p.currency,
      p.trade_price_cents,
      p.price_prefix,
      NULL::text AS stock_status,
      p.dimensions,
      1 - (p.embedding <=> query_embedding) AS similarity
    FROM public.designer_curator_picks p
    LEFT JOIN public.designers d ON d.id = p.designer_id
    WHERE p.embedding IS NOT NULL
    ORDER BY p.embedding <=> query_embedding
    LIMIT match_count
  ),
  trades AS (
    SELECT
      t.id,
      'trade'::text AS source,
      t.product_name AS title,
      COALESCE(NULLIF(split_part(t.brand_name, ' - ', 1), ''), t.brand_name, 'Unknown') AS designer,
      t.materials,
      t.category,
      t.subcategory,
      t.lead_time,
      t.origin,
      t.default_ship_mode,
      t.currency,
      t.trade_price_cents,
      t.price_prefix,
      t.stock_status_override AS stock_status,
      t.dimensions,
      1 - (t.embedding <=> query_embedding) AS similarity
    FROM public.trade_products t
    WHERE t.embedding IS NOT NULL AND t.is_active = true
    ORDER BY t.embedding <=> query_embedding
    LIMIT match_count
  )
  SELECT * FROM picks
  UNION ALL
  SELECT * FROM trades
  ORDER BY similarity DESC
  LIMIT match_count;
$function$;