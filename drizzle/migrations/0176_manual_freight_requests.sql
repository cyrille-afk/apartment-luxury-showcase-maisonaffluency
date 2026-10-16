CREATE TABLE public.manual_freight_requests (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), quote_id uuid NOT NULL REFERENCES public.trade_quotes(id) ON DELETE CASCADE,
 quote_item_id uuid NOT NULL UNIQUE REFERENCES public.trade_quote_items(id) ON DELETE CASCADE,
 requested_by uuid NOT NULL, product_name text NOT NULL, origin_country text NOT NULL DEFAULT '', destination_country text NOT NULL DEFAULT '', quantity integer NOT NULL DEFAULT 1 CHECK(quantity>0),
 request_notes text, status text NOT NULL DEFAULT 'requested' CHECK(status IN ('requested','quoted')),
 carrier text, supplier_reference text, amount_cents integer CHECK(amount_cents>0), currency text NOT NULL DEFAULT 'EUR' CHECK(currency IN ('EUR','USD','GBP','SGD','HKD','CHF','AED','AUD','CAD','JPY')),
 valid_until date, supplier_notes text, requested_at timestamptz NOT NULL DEFAULT now(), recorded_at timestamptz,
 CHECK(status <> 'quoted' OR (amount_cents IS NOT NULL AND carrier IS NOT NULL AND length(trim(carrier))>0))
);
GRANT SELECT, INSERT, UPDATE ON public.manual_freight_requests TO authenticated;
GRANT ALL ON public.manual_freight_requests TO service_role;
ALTER TABLE public.manual_freight_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Read accessible quote freight" ON public.manual_freight_requests FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.trade_quotes q WHERE q.id=quote_id));
CREATE POLICY "Request freight on editable quote" ON public.manual_freight_requests FOR INSERT TO authenticated WITH CHECK (requested_by=auth.uid() AND status='requested' AND amount_cents IS NULL AND EXISTS(SELECT 1 FROM public.trade_quotes q JOIN public.trade_quote_items i ON i.quote_id=q.id WHERE q.id=manual_freight_requests.quote_id AND i.id=quote_item_id AND (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin') OR (q.status='draft' AND (q.user_id=auth.uid() OR public.can_edit_project(auth.uid(),q.project_id) OR public.can_edit_studio(auth.uid(),q.studio_id))))));
CREATE POLICY "Admins record supplier freight" ON public.manual_freight_requests FOR UPDATE TO authenticated USING(public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin')) WITH CHECK(public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin'));
ALTER TABLE public.trade_quote_extras ADD COLUMN manual_freight_request_id uuid UNIQUE REFERENCES public.manual_freight_requests(id) ON DELETE CASCADE;
CREATE FUNCTION public.sync_manual_freight_extra() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF TG_OP='UPDATE' AND (NEW.quote_id<>OLD.quote_id OR NEW.quote_item_id<>OLD.quote_item_id OR NEW.requested_by<>OLD.requested_by) THEN RAISE EXCEPTION 'Freight request identity cannot change'; END IF;
 IF NEW.status='quoted' THEN
  IF EXISTS(SELECT 1 FROM public.trade_quotes WHERE id=NEW.quote_id AND status IN ('confirmed','deposit_paid','paid','cancelled')) THEN RAISE EXCEPTION 'Confirmed or cancelled quote freight is read-only'; END IF;
  NEW.recorded_at=now();
  INSERT INTO public.trade_quote_extras(quote_id,label,amount_cents,currency,quantity,sort_order,manual_freight_request_id)
  VALUES(NEW.quote_id,'Manual freight · '||NEW.product_name||' · '||NEW.carrier,NEW.amount_cents,NEW.currency,1,1000,NEW.id)
  ON CONFLICT(manual_freight_request_id) DO UPDATE SET label=EXCLUDED.label,amount_cents=EXCLUDED.amount_cents,currency=EXCLUDED.currency,quantity=1,updated_at=now();
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER sync_manual_freight_extra BEFORE UPDATE ON public.manual_freight_requests FOR EACH ROW EXECUTE FUNCTION public.sync_manual_freight_extra();