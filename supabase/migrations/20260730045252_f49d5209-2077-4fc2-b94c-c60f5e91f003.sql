ALTER TABLE public.designer_curator_picks ADD COLUMN IF NOT EXISTS style_tags text[] NOT NULL DEFAULT '{}'::text[];
ALTER TABLE public.trade_products ADD COLUMN IF NOT EXISTS style_tags text[] NOT NULL DEFAULT '{}'::text[];

CREATE INDEX IF NOT EXISTS designer_curator_picks_style_tags_idx ON public.designer_curator_picks USING GIN (style_tags);
CREATE INDEX IF NOT EXISTS trade_products_style_tags_idx ON public.trade_products USING GIN (style_tags);