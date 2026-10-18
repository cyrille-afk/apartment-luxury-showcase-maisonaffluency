CREATE OR REPLACE FUNCTION public.get_instant_transfer_totals(_ref text, _intent text)
RETURNS TABLE (currency text, subtotal_cents integer, discount_cents integer, shipping_cents integer, tax_cents integer, tax_label text, buyer_tax_id text, total_cents integer, status text, updated_at timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT o.currency, o.subtotal_cents::int, o.discount_cents::int, o.shipping_cents::int, o.tax_cents::int, o.tax_label, o.buyer_tax_id, o.total_cents::int, o.status, o.updated_at
  FROM public.shop_orders o
  WHERE o.order_ref = _ref
    AND o.payment_method = 'instant_bank_transfer'
    AND _intent IS NOT NULL AND length(_intent) > 10
    AND o.stripe_session_id = _intent
  LIMIT 1
$$;
REVOKE ALL ON FUNCTION public.get_instant_transfer_totals(text, text) FROM public;
GRANT EXECUTE ON FUNCTION public.get_instant_transfer_totals(text, text) TO anon, authenticated, service_role;