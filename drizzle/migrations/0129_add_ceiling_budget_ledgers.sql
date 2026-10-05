ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS ceiling_ledger_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS target_ceiling_cents bigint,
  ADD COLUMN IF NOT EXISTS ceiling_currency text,
  ADD COLUMN IF NOT EXISTS client_markup_pct numeric,
  ADD COLUMN IF NOT EXISTS ceiling_trade_discount_pct numeric,
  ADD COLUMN IF NOT EXISTS ceiling_tier_label text;

ALTER TABLE public.trade_quotes
  ADD COLUMN IF NOT EXISTS ceiling_ledger_mode text NOT NULL DEFAULT 'inherit',
  ADD COLUMN IF NOT EXISTS target_ceiling_cents bigint,
  ADD COLUMN IF NOT EXISTS ceiling_currency text,
  ADD COLUMN IF NOT EXISTS client_markup_pct numeric,
  ADD COLUMN IF NOT EXISTS ceiling_trade_discount_pct numeric,
  ADD COLUMN IF NOT EXISTS ceiling_tier_label text;

COMMENT ON COLUMN public.projects.ceiling_ledger_enabled IS 'Project default: render linked proformas as a top-down target ceiling budget ledger.';
COMMENT ON COLUMN public.trade_quotes.ceiling_ledger_mode IS 'Quote override: inherit, itemized, or target_ceiling.';