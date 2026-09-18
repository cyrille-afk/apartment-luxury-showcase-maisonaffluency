ALTER TABLE public.designers
  ADD COLUMN IF NOT EXISTS wholesale_discount_pct NUMERIC(5,2);

CREATE TABLE IF NOT EXISTS public.purchase_orders_payable (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID,
  line_item_id UUID,
  designer_id UUID,
  designer_name TEXT,
  currency TEXT NOT NULL DEFAULT 'usd',
  retail_rrp INTEGER NOT NULL DEFAULT 0,
  wholesale_discount_pct NUMERIC(5,2) NOT NULL DEFAULT 30.00,
  purchase_cost_cogs INTEGER NOT NULL DEFAULT 0,
  sold_price_gross INTEGER NOT NULL DEFAULT 0,
  retail_discount_applied INTEGER NOT NULL DEFAULT 0,
  stripe_processing_fees INTEGER NOT NULL DEFAULT 0,
  net_maison_margin INTEGER NOT NULL DEFAULT 0,
  trade_program_id TEXT,
  designer_invoice_status TEXT NOT NULL DEFAULT 'pending',
  designer_invoice_reference TEXT,
  invoice_received_at TIMESTAMPTZ,
  approved_at TIMESTAMPTZ,
  approved_by UUID,
  paid_at TIMESTAMPTZ,
  stripe_session_id TEXT,
  stripe_payment_intent_id TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS pop_line_item_uniq
  ON public.purchase_orders_payable (line_item_id);
CREATE INDEX IF NOT EXISTS pop_designer_idx ON public.purchase_orders_payable (designer_id);
CREATE INDEX IF NOT EXISTS pop_status_idx ON public.purchase_orders_payable (designer_invoice_status);
CREATE INDEX IF NOT EXISTS pop_order_idx ON public.purchase_orders_payable (order_id);

GRANT SELECT, INSERT, UPDATE ON public.purchase_orders_payable TO authenticated;
GRANT ALL ON public.purchase_orders_payable TO service_role;

ALTER TABLE public.purchase_orders_payable ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage wholesale payables"
  ON public.purchase_orders_payable FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'));

INSERT INTO public.purchase_orders_payable (
  order_id, line_item_id, designer_id, designer_name, currency,
  retail_rrp, wholesale_discount_pct, purchase_cost_cogs, sold_price_gross,
  retail_discount_applied, stripe_processing_fees, net_maison_margin,
  trade_program_id, designer_invoice_status, stripe_session_id,
  stripe_payment_intent_id, created_at
)
SELECT
  p.order_id, p.line_item_id, p.designer_id, p.designer_name, p.currency,
  p.gross_amount,
  GREATEST(0, 100 - p.commission_rate_pct),
  ROUND(p.gross_amount * p.commission_rate_pct / 100.0)::INTEGER,
  GREATEST(0, p.gross_amount - p.trade_discount_applied),
  p.trade_discount_applied,
  p.stripe_fee_cents,
  GREATEST(0, p.gross_amount - p.trade_discount_applied)
    - ROUND(p.gross_amount * p.commission_rate_pct / 100.0)::INTEGER
    - p.stripe_fee_cents,
  p.trade_program_id,
  CASE p.payout_status WHEN 'paid' THEN 'paid' WHEN 'approved' THEN 'approved' ELSE 'pending' END,
  p.stripe_session_id, p.stripe_payment_intent_id, p.created_at
FROM public.designer_payouts p
WHERE p.line_item_id IS NOT NULL
ON CONFLICT (line_item_id) DO NOTHING;