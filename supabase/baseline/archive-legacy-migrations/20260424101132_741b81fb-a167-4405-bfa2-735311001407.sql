CREATE OR REPLACE FUNCTION public.get_designer_engagement(_since timestamptz)
RETURNS TABLE(
  brand_name text,
  quote_users bigint,
  quote_lines bigint,
  board_users bigint,
  board_items bigint
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
    SELECT tp.brand_name,
           tq.user_id,
           qi.id AS line_id
    FROM public.trade_quote_items qi
    JOIN public.trade_quotes tq ON tq.id = qi.quote_id
    JOIN public.trade_products tp ON tp.id = qi.product_id
    WHERE qi.created_at >= _since
      AND tq.user_id NOT IN (SELECT user_id FROM admin_ids)
      AND COALESCE(tp.brand_name, '') <> ''
  ),
  b AS (
    SELECT tp.brand_name,
           cb.user_id,
           bi.id AS item_id
    FROM public.client_board_items bi
    JOIN public.client_boards cb ON cb.id = bi.board_id
    JOIN public.trade_products tp ON tp.id = bi.product_id
    WHERE bi.created_at >= _since
      AND cb.user_id NOT IN (SELECT user_id FROM admin_ids)
      AND COALESCE(tp.brand_name, '') <> ''
  ),
  agg_q AS (
    SELECT brand_name,
           COUNT(DISTINCT user_id) AS quote_users,
           COUNT(line_id) AS quote_lines
    FROM q GROUP BY brand_name
  ),
  agg_b AS (
    SELECT brand_name,
           COUNT(DISTINCT user_id) AS board_users,
           COUNT(item_id) AS board_items
    FROM b GROUP BY brand_name
  )
  SELECT COALESCE(agg_q.brand_name, agg_b.brand_name) AS brand_name,
         COALESCE(agg_q.quote_users, 0) AS quote_users,
         COALESCE(agg_q.quote_lines, 0) AS quote_lines,
         COALESCE(agg_b.board_users, 0) AS board_users,
         COALESCE(agg_b.board_items, 0) AS board_items
  FROM agg_q
  FULL OUTER JOIN agg_b USING (brand_name)
  WHERE public.has_role(auth.uid(), 'admin'::app_role);
$$;