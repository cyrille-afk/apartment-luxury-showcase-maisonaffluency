ALTER TABLE public.designer_curator_picks ADD COLUMN IF NOT EXISTS meta_description text;
ALTER TABLE public.trade_products ADD COLUMN IF NOT EXISTS meta_description text;