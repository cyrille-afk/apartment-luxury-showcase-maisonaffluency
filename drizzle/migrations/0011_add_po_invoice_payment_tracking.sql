ALTER TABLE public.trade_quote_items
  ADD COLUMN IF NOT EXISTS supplier_invoice_status TEXT NOT NULL DEFAULT 'missing',
  ADD COLUMN IF NOT EXISTS supplier_invoice_total_cents BIGINT,
  ADD COLUMN IF NOT EXISTS po_payment_status TEXT NOT NULL DEFAULT 'unpaid',
  ADD COLUMN IF NOT EXISTS po_due_date DATE,
  ADD COLUMN IF NOT EXISTS po_deposit_paid_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS po_balance_due_date DATE,
  ADD COLUMN IF NOT EXISTS po_fully_paid_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS trade_quote_items_po_payment_status_idx
  ON public.trade_quote_items (po_payment_status);
