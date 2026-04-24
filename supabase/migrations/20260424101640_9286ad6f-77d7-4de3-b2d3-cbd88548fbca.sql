CREATE OR REPLACE FUNCTION public.get_brand_engagement_users(_brand_name text, _since timestamptz)
RETURNS TABLE(
  user_id uuid,
  email text,
  first_name text,
  last_name text,
  company text,
  quote_lines bigint,
  board_items bigint,
  source text
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  WITH admin_ids AS (
    SELECT DISTINCT ur.user_id
    FROM public.user_roles ur
    WHERE ur.role IN ('admin'::app_role, 'super_admin'::app_role)
  ),
  q AS (
    SELECT tq.user_id, COUNT(qi.id) AS quote_lines
    FROM public.trade_quote_items qi
    JOIN public.trade_quotes tq ON tq.id = qi.quote_id
    JOIN public.trade_products tp ON tp.id = qi.product_id
    WHERE qi.created_at >= _since
      AND tp.brand_name = _brand_name
      AND tq.user_id NOT IN (SELECT user_id FROM admin_ids)
    GROUP BY tq.user_id
  ),
  b AS (
    SELECT cb.user_id, COUNT(bi.id) AS board_items
    FROM public.client_board_items bi
    JOIN public.client_boards cb ON cb.id = bi.board_id
    JOIN public.trade_products tp ON tp.id = bi.product_id
    WHERE bi.created_at >= _since
      AND tp.brand_name = _brand_name
      AND cb.user_id NOT IN (SELECT user_id FROM admin_ids)
    GROUP BY cb.user_id
  ),
  combined AS (
    SELECT COALESCE(q.user_id, b.user_id) AS user_id,
           COALESCE(q.quote_lines, 0) AS quote_lines,
           COALESCE(b.board_items, 0) AS board_items,
           CASE
             WHEN q.user_id IS NOT NULL AND b.user_id IS NOT NULL THEN 'both'
             WHEN q.user_id IS NOT NULL THEN 'quote'
             ELSE 'board'
           END AS source
    FROM q FULL OUTER JOIN b USING (user_id)
  )
  SELECT c.user_id,
         p.email,
         p.first_name,
         p.last_name,
         p.company,
         c.quote_lines,
         c.board_items,
         c.source
  FROM combined c
  LEFT JOIN public.profiles p ON p.id = c.user_id
  WHERE public.has_role(auth.uid(), 'admin'::app_role)
  ORDER BY (c.quote_lines + c.board_items) DESC;
$$;