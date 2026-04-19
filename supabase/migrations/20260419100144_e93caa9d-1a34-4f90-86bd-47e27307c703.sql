ALTER TABLE public.designer_curator_picks
ADD COLUMN IF NOT EXISTS size_variants jsonb DEFAULT '[]'::jsonb;

COMMENT ON COLUMN public.designer_curator_picks.size_variants IS 'Array of {label: string, price_cents: number} entries. When non-empty, takes precedence over trade_price_cents for display.';