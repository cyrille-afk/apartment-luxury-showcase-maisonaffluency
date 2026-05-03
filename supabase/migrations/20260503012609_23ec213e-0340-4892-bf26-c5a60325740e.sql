ALTER TABLE public.trade_quote_items ADD COLUMN IF NOT EXISTS room TEXT;
CREATE INDEX IF NOT EXISTS idx_trade_quote_items_quote_room ON public.trade_quote_items(quote_id, room);