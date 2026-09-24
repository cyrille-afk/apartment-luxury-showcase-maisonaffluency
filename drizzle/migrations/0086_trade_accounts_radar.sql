ALTER TABLE public.trade_accounts
  ADD COLUMN IF NOT EXISTS radar_score integer,
  ADD COLUMN IF NOT EXISTS radar_flag text,
  ADD COLUMN IF NOT EXISTS radar_status text NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS radar_scored_at timestamptz;