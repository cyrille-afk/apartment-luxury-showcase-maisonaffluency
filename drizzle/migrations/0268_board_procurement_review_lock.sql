ALTER TABLE public.client_board_items ADD COLUMN IF NOT EXISTS procurement_quote_id uuid REFERENCES public.trade_quotes(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS client_board_items_procurement_quote_idx ON public.client_board_items(procurement_quote_id) WHERE procurement_quote_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.guard_procurement_locked_board_item()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF OLD.procurement_quote_id IS NOT NULL AND NEW.procurement_quote_id IS NOT DISTINCT FROM OLD.procurement_quote_id AND (
    NEW.variant_label IS DISTINCT FROM OLD.variant_label OR
    NEW.fabric_label IS DISTINCT FROM OLD.fabric_label OR
    NEW.wood_label IS DISTINCT FROM OLD.wood_label OR
    NEW.approval_status IS DISTINCT FROM OLD.approval_status OR
    NEW.product_id IS DISTINCT FROM OLD.product_id
  ) THEN
    RAISE EXCEPTION 'This piece is locked while in procurement review' USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS guard_procurement_locked_board_item ON public.client_board_items;
CREATE TRIGGER guard_procurement_locked_board_item BEFORE UPDATE ON public.client_board_items
FOR EACH ROW EXECUTE FUNCTION public.guard_procurement_locked_board_item();