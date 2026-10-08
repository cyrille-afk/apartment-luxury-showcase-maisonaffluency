CREATE OR REPLACE FUNCTION public.tg_fill_quote_item_catalogue_price()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _cents bigint; _ccy text;
BEGIN
  IF NEW.unit_price_cents IS NULL AND NEW.product_id IS NOT NULL THEN
    SELECT COALESCE(NULLIF(tp.trade_price_cents,0), NULLIF(tp.rrp_price_cents,0)), tp.currency
      INTO _cents, _ccy FROM public.trade_products tp WHERE tp.id = NEW.product_id;
    IF _cents IS NOT NULL THEN
      NEW.unit_price_cents := _cents;
      NEW.unit_price_currency := COALESCE(_ccy, 'EUR');
    END IF;
  END IF;
  RETURN NEW;
END $$;
-- "zz_" prefix: fires after the pricing guards so the catalogue price is not cleared.
CREATE TRIGGER zz_fill_quote_item_catalogue_price
BEFORE INSERT ON public.trade_quote_items
FOR EACH ROW EXECUTE FUNCTION public.tg_fill_quote_item_catalogue_price();