ALTER TABLE public.shop_orders
  ADD COLUMN IF NOT EXISTS customer_po_number text,
  ADD COLUMN IF NOT EXISTS company_name text,
  ADD COLUMN IF NOT EXISTS company_registration_number text,
  ADD COLUMN IF NOT EXISTS po_payment_terms text,
  ADD COLUMN IF NOT EXISTS budget_approved_at timestamptz,
  ADD COLUMN IF NOT EXISTS po_review_status text;

COMMENT ON COLUMN public.shop_orders.customer_po_number IS 'Buyer internal purchase-order reference submitted at checkout.';
COMMENT ON COLUMN public.shop_orders.company_name IS 'Legal corporate buyer name captured for purchase-order review.';
COMMENT ON COLUMN public.shop_orders.company_registration_number IS 'Corporate registration number supplied by the buyer.';
COMMENT ON COLUMN public.shop_orders.po_payment_terms IS 'Requested corporate payment terms, subject to Maison Affluency approval.';
COMMENT ON COLUMN public.shop_orders.budget_approved_at IS 'Timestamp when the buyer attested that internal budget approval was secured.';
COMMENT ON COLUMN public.shop_orders.po_review_status IS 'Manual purchase-order review state: pending, approved, declined, or terms_required.';

CREATE INDEX IF NOT EXISTS shop_orders_po_review_status_idx
  ON public.shop_orders (po_review_status, created_at DESC)
  WHERE payment_method = 'purchase_order';