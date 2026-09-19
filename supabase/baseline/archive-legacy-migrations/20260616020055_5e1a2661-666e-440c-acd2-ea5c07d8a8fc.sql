
ALTER TABLE public.trade_quote_items
  ADD COLUMN IF NOT EXISTS wood_fabric_id uuid REFERENCES public.fabrics(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS trade_quote_items_wood_fabric_id_idx
  ON public.trade_quote_items(wood_fabric_id);
