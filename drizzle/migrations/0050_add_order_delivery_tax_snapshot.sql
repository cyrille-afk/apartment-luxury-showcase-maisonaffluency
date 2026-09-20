ALTER TABLE public.shop_orders
  ADD COLUMN IF NOT EXISTS shipping_country text,
  ADD COLUMN IF NOT EXISTS delivery_term text,
  ADD COLUMN IF NOT EXISTS import_duty_cents integer DEFAULT 0 NOT NULL,
  ADD COLUMN IF NOT EXISTS import_tax_cents integer DEFAULT 0 NOT NULL,
  ADD COLUMN IF NOT EXISTS import_clearance_cents integer DEFAULT 0 NOT NULL,
  ADD COLUMN IF NOT EXISTS ddp_handling_cents integer DEFAULT 0 NOT NULL,
  ADD COLUMN IF NOT EXISTS import_total_cents integer DEFAULT 0 NOT NULL,
  ADD COLUMN IF NOT EXISTS deferred_import_cents integer DEFAULT 0 NOT NULL,
  ADD COLUMN IF NOT EXISTS customs_statement text;

COMMENT ON COLUMN public.shop_orders.shipping_country IS 'ISO 3166-1 alpha-2 delivery destination captured when the order is priced.';
COMMENT ON COLUMN public.shop_orders.delivery_term IS 'Delivery term agreed at checkout, normally DDP or DDU.';
COMMENT ON COLUMN public.shop_orders.customs_statement IS 'Immutable destination-aware customs and import-charge wording shown to the buyer.';