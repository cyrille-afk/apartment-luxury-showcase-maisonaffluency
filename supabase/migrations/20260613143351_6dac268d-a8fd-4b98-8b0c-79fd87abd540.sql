ALTER TABLE public.order_timeline
  ADD COLUMN IF NOT EXISTS commission_statement_sent_at timestamptz;