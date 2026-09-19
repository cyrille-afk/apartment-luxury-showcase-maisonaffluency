-- Storage access: buyers keep files under their own auth.uid() folder; admins see all.
DROP POLICY IF EXISTS "Receipts: owner insert" ON storage.objects;
CREATE POLICY "Receipts: owner insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'payment-receipts' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "Receipts: owner or admin read" ON storage.objects;
CREATE POLICY "Receipts: owner or admin read" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'payment-receipts'
         AND ((storage.foldername(name))[1] = auth.uid()::text OR public.has_role(auth.uid(), 'admin')));

DROP POLICY IF EXISTS "Invoices: owner insert" ON storage.objects;
CREATE POLICY "Invoices: owner insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'proforma-invoices' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "Invoices: owner or admin read" ON storage.objects;
CREATE POLICY "Invoices: owner or admin read" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'proforma-invoices'
         AND ((storage.foldername(name))[1] = auth.uid()::text OR public.has_role(auth.uid(), 'admin')));

-- Buyers may only attach a receipt: everything else on their order is locked.
CREATE OR REPLACE FUNCTION public.guard_shop_order_buyer_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF public.has_role(auth.uid(), 'admin') OR auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;
  IF NEW.status IS DISTINCT FROM OLD.status
     OR NEW.total_cents IS DISTINCT FROM OLD.total_cents
     OR NEW.subtotal_cents IS DISTINCT FROM OLD.subtotal_cents
     OR NEW.shipping_cents IS DISTINCT FROM OLD.shipping_cents
     OR NEW.tax_cents IS DISTINCT FROM OLD.tax_cents
     OR NEW.discount_cents IS DISTINCT FROM OLD.discount_cents
     OR NEW.discount_pct IS DISTINCT FROM OLD.discount_pct
     OR NEW.currency IS DISTINCT FROM OLD.currency
     OR NEW.user_id IS DISTINCT FROM OLD.user_id
     OR NEW.order_ref IS DISTINCT FROM OLD.order_ref
     OR NEW.paid_at IS DISTINCT FROM OLD.paid_at
     OR NEW.marked_paid_by IS DISTINCT FROM OLD.marked_paid_by THEN
    RAISE EXCEPTION 'Only the payment receipt may be updated on your order';
  END IF;
  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.guard_shop_order_buyer_update() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_guard_shop_order_buyer_update ON public.shop_orders;
CREATE TRIGGER trg_guard_shop_order_buyer_update
  BEFORE UPDATE ON public.shop_orders
  FOR EACH ROW EXECUTE FUNCTION public.guard_shop_order_buyer_update();