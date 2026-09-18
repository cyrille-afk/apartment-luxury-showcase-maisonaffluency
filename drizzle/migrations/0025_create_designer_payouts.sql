-- Designer commission configuration
ALTER TABLE public.designers
  ADD COLUMN IF NOT EXISTS commission_rate_pct NUMERIC(5,2),
  ADD COLUMN IF NOT EXISTS trade_discount_absorption TEXT NOT NULL DEFAULT 'platform';

-- Multi-vendor commission ledger. All money is stored as integer minor units.
CREATE TABLE IF NOT EXISTS public.designer_payouts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID,
  line_item_id UUID,
  designer_id UUID,
  designer_name TEXT,
  currency TEXT NOT NULL DEFAULT 'usd',
  gross_amount INTEGER NOT NULL DEFAULT 0,
  trade_discount_applied INTEGER NOT NULL DEFAULT 0,
  trade_program_id TEXT,
  discount_absorbed_by TEXT NOT NULL DEFAULT 'platform',
  commission_rate_pct NUMERIC(5,2) NOT NULL DEFAULT 70.00,
  stripe_fee_cents INTEGER NOT NULL DEFAULT 0,
  platform_fee INTEGER NOT NULL DEFAULT 0,
  designer_net_payout INTEGER NOT NULL DEFAULT 0,
  payout_status TEXT NOT NULL DEFAULT 'pending',
  stripe_session_id TEXT,
  stripe_payment_intent_id TEXT,
  approved_at TIMESTAMPTZ,
  approved_by UUID,
  paid_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS designer_payouts_line_item_uniq
  ON public.designer_payouts (line_item_id) WHERE line_item_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS designer_payouts_designer_idx ON public.designer_payouts (designer_id);
CREATE INDEX IF NOT EXISTS designer_payouts_status_idx ON public.designer_payouts (payout_status);
CREATE INDEX IF NOT EXISTS designer_payouts_order_idx ON public.designer_payouts (order_id);

GRANT SELECT, INSERT, UPDATE ON public.designer_payouts TO authenticated;
GRANT ALL ON public.designer_payouts TO service_role;

ALTER TABLE public.designer_payouts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage designer payouts"
  ON public.designer_payouts FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'));