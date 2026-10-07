ALTER TABLE public.trade_products
  ADD COLUMN IF NOT EXISTS design_style_tokens text[] NOT NULL DEFAULT '{}'::text[],
  ADD COLUMN IF NOT EXISTS dimensions_cubic jsonb;
COMMENT ON COLUMN public.trade_products.design_style_tokens IS 'Curatorial style tokens (e.g. Warm Minimalism) used by the AI curation engine.';
COMMENT ON COLUMN public.trade_products.dimensions_cubic IS 'Bounding box in metres {w,d,h} for layout collision checks.';
CREATE INDEX IF NOT EXISTS trade_products_design_style_tokens_gin ON public.trade_products USING gin (design_style_tokens);