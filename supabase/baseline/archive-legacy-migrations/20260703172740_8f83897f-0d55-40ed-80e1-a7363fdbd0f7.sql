ALTER TABLE public.trade_applications
  ADD COLUMN IF NOT EXISTS edit_completed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS edit_completed_by_name TEXT;