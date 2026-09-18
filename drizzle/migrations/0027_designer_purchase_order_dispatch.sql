ALTER TABLE public.designers
  ADD COLUMN IF NOT EXISTS fulfillment_email TEXT,
  ADD COLUMN IF NOT EXISTS wholesale_contract_tier TEXT;

CREATE TABLE IF NOT EXISTS public.designer_purchase_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  po_number TEXT NOT NULL UNIQUE,
  order_id UUID,
  designer_id UUID,
  designer_name TEXT,
  designer_email TEXT,
  wholesale_contract_tier TEXT,
  currency TEXT NOT NULL DEFAULT 'usd',
  line_count INTEGER NOT NULL DEFAULT 0,
  total_retail_rrp INTEGER NOT NULL DEFAULT 0,
  total_purchase_cost_cogs INTEGER NOT NULL DEFAULT 0,
  document_path TEXT,
  email_status TEXT NOT NULL DEFAULT 'pending',
  email_error TEXT,
  stripe_session_id TEXT,
  dispatched_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS dpo_order_idx ON public.designer_purchase_orders (order_id);
CREATE INDEX IF NOT EXISTS dpo_designer_idx ON public.designer_purchase_orders (designer_id);
CREATE UNIQUE INDEX IF NOT EXISTS dpo_order_designer_uniq
  ON public.designer_purchase_orders (order_id, designer_id);

GRANT SELECT ON public.designer_purchase_orders TO authenticated;
GRANT ALL ON public.designer_purchase_orders TO service_role;

ALTER TABLE public.designer_purchase_orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins read designer purchase orders"
  ON public.designer_purchase_orders FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'));

ALTER TABLE public.purchase_orders_payable
  ADD COLUMN IF NOT EXISTS purchase_order_id UUID,
  ADD COLUMN IF NOT EXISTS po_number TEXT;

CREATE OR REPLACE FUNCTION public.next_designer_po_number()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  seq INTEGER;
  today TEXT := to_char(now() AT TIME ZONE 'UTC', 'YYYY-MMDD');
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext('designer_po_sequence'));
  SELECT COUNT(*) + 1 INTO seq
  FROM public.designer_purchase_orders
  WHERE po_number LIKE 'PO-' || today || '-%';
  RETURN 'PO-' || today || '-' || lpad(seq::TEXT, 3, '0');
END;
$$;

GRANT EXECUTE ON FUNCTION public.next_designer_po_number() TO service_role;