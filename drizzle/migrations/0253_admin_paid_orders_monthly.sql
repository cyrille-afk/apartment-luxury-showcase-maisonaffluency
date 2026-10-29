CREATE OR REPLACE FUNCTION public.admin_paid_orders_monthly(_months integer DEFAULT 12, _include_test boolean DEFAULT false)
RETURNS TABLE(month date, source text, currency text, order_count bigint, total_cents bigint)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'Forbidden'; END IF;
  RETURN QUERY
  WITH stripe_raw AS (
    SELECT w.created_at,
      w.payload->'data'->'object' AS o,
      w.event_type,
      COALESCE((w.payload->>'livemode')::boolean, false) AS live
    FROM webhook_events w
    WHERE w.provider = 'stripe' AND w.status = 'processed'
      AND w.event_type IN ('checkout.session.completed','checkout.session.async_payment_succeeded','payment_intent.succeeded')
      AND w.created_at >= date_trunc('month', now()) - make_interval(months => GREATEST(_months,1) - 1)
  ), stripe_paid AS (
    SELECT DISTINCT ON (key) key, created_at, cur, amt FROM (
      SELECT COALESCE(o->>'payment_intent', o->>'id') AS key, created_at,
        upper(o->>'currency') AS cur,
        CASE WHEN event_type = 'payment_intent.succeeded' THEN COALESCE((o->>'amount_received')::bigint,(o->>'amount')::bigint)
             ELSE (o->>'amount_total')::bigint END AS amt
      FROM stripe_raw
      WHERE (live OR _include_test)
        AND (event_type = 'payment_intent.succeeded' OR o->>'payment_status' = 'paid')
    ) s WHERE key IS NOT NULL ORDER BY key, created_at
  ), bank AS (
    SELECT paid_at, upper(currency) AS cur, total_cents::bigint AS amt FROM shop_orders
    WHERE marked_paid_by IS NOT NULL AND paid_at IS NOT NULL AND status = 'paid'
      AND paid_at >= date_trunc('month', now()) - make_interval(months => GREATEST(_months,1) - 1)
  )
  SELECT date_trunc('month', created_at)::date, 'payment_notice'::text, cur, count(*), COALESCE(sum(amt),0)::bigint FROM stripe_paid GROUP BY 1,3
  UNION ALL
  SELECT date_trunc('month', paid_at)::date, 'bank_transfer'::text, cur, count(*), COALESCE(sum(amt),0)::bigint FROM bank GROUP BY 1,3
  ORDER BY 1 DESC, 2, 3;
END $$;
REVOKE ALL ON FUNCTION public.admin_paid_orders_monthly(integer, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_paid_orders_monthly(integer, boolean) TO authenticated;