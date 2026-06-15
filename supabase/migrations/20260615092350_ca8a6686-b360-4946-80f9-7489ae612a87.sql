
ALTER TABLE public.fabrics
  ADD COLUMN IF NOT EXISTS tier text CHECK (tier IS NULL OR tier IN ('A','B','C','D','E')),
  ADD COLUMN IF NOT EXISTS price_per_lm_cents integer,
  ADD COLUMN IF NOT EXISTS currency text NOT NULL DEFAULT 'EUR';

ALTER TABLE public.designer_curator_picks
  ADD COLUMN IF NOT EXISTS com_meters numeric(6,2);

ALTER TABLE public.trade_quote_items
  ADD COLUMN IF NOT EXISTS fabric_id uuid REFERENCES public.fabrics(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS fabric_meters numeric(6,2),
  ADD COLUMN IF NOT EXISTS fabric_upcharge_cents integer,
  ADD COLUMN IF NOT EXISTS fabric_currency text;

CREATE INDEX IF NOT EXISTS trade_quote_items_fabric_idx ON public.trade_quote_items(fabric_id);
