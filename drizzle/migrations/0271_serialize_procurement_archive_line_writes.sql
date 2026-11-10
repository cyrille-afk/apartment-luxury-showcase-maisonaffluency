CREATE OR REPLACE FUNCTION public.guard_procurement_archive_line() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE issued timestamptz;
BEGIN
 IF TG_OP <> 'INSERT' THEN
  SELECT procurement_issued_at INTO issued FROM public.trade_quotes WHERE id = OLD.quote_id FOR UPDATE;
  IF issued IS NOT NULL AND auth.role() IS DISTINCT FROM 'service_role' THEN RAISE EXCEPTION 'Issued procurement line items are read-only'; END IF;
 END IF;
 IF TG_OP <> 'DELETE' THEN
  SELECT procurement_issued_at INTO issued FROM public.trade_quotes WHERE id = NEW.quote_id FOR UPDATE;
  IF issued IS NOT NULL AND auth.role() IS DISTINCT FROM 'service_role' THEN RAISE EXCEPTION 'Issued procurement line items are read-only'; END IF;
  RETURN NEW;
 END IF;
 RETURN OLD;
END $$;