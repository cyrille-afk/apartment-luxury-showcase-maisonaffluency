ALTER TABLE public.shop_orders
  ADD COLUMN IF NOT EXISTS region_tier text,
  ADD COLUMN IF NOT EXISTS payment_channel text,
  ADD COLUMN IF NOT EXISTS tax_cents integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS tax_label text,
  ADD COLUMN IF NOT EXISTS payment_receipt_path text,
  ADD COLUMN IF NOT EXISTS proforma_invoice_path text,
  ADD COLUMN IF NOT EXISTS shipping_address text,
  ADD COLUMN IF NOT EXISTS phone text,
  ADD COLUMN IF NOT EXISTS paid_at timestamptz,
  ADD COLUMN IF NOT EXISTS marked_paid_by uuid,
  ADD COLUMN IF NOT EXISTS payment_confirmation_sent_at timestamptz;

CREATE INDEX IF NOT EXISTS shop_orders_status_idx ON public.shop_orders (status, created_at DESC);

-- Admins reconcile orders from the private ledger.
DROP POLICY IF EXISTS "Admins manage orders" ON public.shop_orders;
CREATE POLICY "Admins manage orders" ON public.shop_orders
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Buyers may attach their own payment receipt to their own order.
DROP POLICY IF EXISTS "Users attach receipt to own order" ON public.shop_orders;
CREATE POLICY "Users attach receipt to own order" ON public.shop_orders
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

GRANT SELECT, UPDATE ON public.shop_orders TO authenticated;
GRANT ALL ON public.shop_orders TO service_role;
GRANT SELECT ON public.shop_order_items TO authenticated;
GRANT ALL ON public.shop_order_items TO service_role;