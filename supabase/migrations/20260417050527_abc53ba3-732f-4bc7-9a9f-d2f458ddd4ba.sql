ALTER TABLE public.designer_curator_picks ADD COLUMN IF NOT EXISTS origin text;
ALTER TABLE public.trade_products ADD COLUMN IF NOT EXISTS origin text;