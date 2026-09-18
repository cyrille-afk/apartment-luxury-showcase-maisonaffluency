ALTER TABLE public.purchase_orders_payable
  ADD COLUMN IF NOT EXISTS requires_manual_followup BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS followup_flagged_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_escalated_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_pop_requires_followup
  ON public.purchase_orders_payable (requires_manual_followup)
  WHERE requires_manual_followup;

ALTER TABLE public.designer_purchase_orders
  ADD COLUMN IF NOT EXISTS requires_manual_followup BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS escalation_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_escalated_at TIMESTAMPTZ;