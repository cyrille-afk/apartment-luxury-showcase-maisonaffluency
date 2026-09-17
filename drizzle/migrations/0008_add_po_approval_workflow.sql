ALTER TABLE public.trade_quote_items
  ADD COLUMN IF NOT EXISTS po_status TEXT NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS po_approved_by UUID,
  ADD COLUMN IF NOT EXISTS po_approved_by_name TEXT,
  ADD COLUMN IF NOT EXISTS po_approved_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS po_change_request_note TEXT;

CREATE INDEX IF NOT EXISTS trade_quote_items_po_status_idx ON public.trade_quote_items (po_status);