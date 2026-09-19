ALTER TABLE public.shop_orders
  ADD COLUMN IF NOT EXISTS buyer_type text,
  ADD COLUMN IF NOT EXISTS buyer_tax_id text,
  ADD COLUMN IF NOT EXISTS buyer_tax_country text,
  ADD COLUMN IF NOT EXISTS tax_treatment text,
  ADD COLUMN IF NOT EXISTS tax_rate numeric,
  ADD COLUMN IF NOT EXISTS tax_statement text,
  ADD COLUMN IF NOT EXISTS merchant_tax_registration text;

COMMENT ON COLUMN public.shop_orders.buyer_tax_id IS 'Buyer VAT/GST registration captured at checkout; printed on the invoice and PDF.';
COMMENT ON COLUMN public.shop_orders.tax_treatment IS 'standard | b2b_zero_rated | reverse_charge | export_zero_rated | none';
