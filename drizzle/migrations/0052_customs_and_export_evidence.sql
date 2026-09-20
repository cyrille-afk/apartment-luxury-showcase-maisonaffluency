-- Customs classification on product records (HS6 + ad-valorem duty rate).
ALTER TABLE public.trade_products
  ADD COLUMN IF NOT EXISTS hs6_code text,
  ADD COLUMN IF NOT EXISTS duty_rate numeric;

ALTER TABLE public.designer_curator_picks
  ADD COLUMN IF NOT EXISTS hs6_code text,
  ADD COLUMN IF NOT EXISTS duty_rate numeric;

-- Bind the classification to each ordered line so landed cost is reproducible.
ALTER TABLE public.shop_order_items
  ADD COLUMN IF NOT EXISTS hs6_code text,
  ADD COLUMN IF NOT EXISTS duty_rate numeric,
  ADD COLUMN IF NOT EXISTS origin_country text;

-- Order-level tax routing + statutory evidence of export.
ALTER TABLE public.shop_orders
  ADD COLUMN IF NOT EXISTS ship_from_country text,
  ADD COLUMN IF NOT EXISTS buyer_tax_id_verified boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS buyer_tax_id_verification_source text,
  ADD COLUMN IF NOT EXISTS customs_clearance_cents integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS estimated_duty_cents integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS requires_ddp_clearance boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS merchant_tax_identifier text,
  -- Evidence of export, piece 1: carrier tracking / airway bill reference.
  ADD COLUMN IF NOT EXISTS export_evidence_tracking_id text,
  -- Evidence of export, piece 2: hash of the destination customs declaration.
  ADD COLUMN IF NOT EXISTS export_evidence_declaration_hash text,
  ADD COLUMN IF NOT EXISTS export_evidence_captured_at timestamptz;

COMMENT ON COLUMN public.shop_orders.export_evidence_tracking_id IS 'Carrier tracking / AWB number evidencing physical export. Required to defend a zero-rated or reverse-charge supply.';
COMMENT ON COLUMN public.shop_orders.export_evidence_declaration_hash IS 'SHA-256 of the destination customs declaration document. Second statutory piece of evidence of export.';

CREATE INDEX IF NOT EXISTS shop_orders_requires_ddp_clearance_idx
  ON public.shop_orders (requires_ddp_clearance)
  WHERE requires_ddp_clearance;

CREATE INDEX IF NOT EXISTS shop_orders_export_evidence_pending_idx
  ON public.shop_orders (created_at DESC)
  WHERE export_evidence_captured_at IS NULL;