-- Records how each cross-border consignment was routed for customs, so the
-- VAT treatment on an order can be audited years later: 'CARRIER_DDP' (the
-- forwarder imports on our behalf) or 'MERCHANT_IOSS' (we account for the VAT
-- under our own IOSS registration).
ALTER TABLE public.shop_orders
  ADD COLUMN IF NOT EXISTS customs_route TEXT,
  ADD COLUMN IF NOT EXISTS merchant_ioss_number TEXT;

CREATE INDEX IF NOT EXISTS idx_shop_orders_customs_route
  ON public.shop_orders (customs_route)
  WHERE customs_route IS NOT NULL;