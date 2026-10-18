CREATE OR REPLACE FUNCTION public.validate_felix_quote_snapshot() RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path=public AS $$
DECLARE card jsonb;
BEGIN
 IF NEW.felix_snapshot IS NULL OR (TG_OP='UPDATE' AND NEW.felix_snapshot IS NOT DISTINCT FROM OLD.felix_snapshot) THEN RETURN NEW; END IF;
 IF auth.uid() IS NOT NULL THEN
  IF NEW.user_id IS DISTINCT FROM auth.uid() THEN RAISE EXCEPTION 'Only your own Felix drafts can be saved'; END IF;
  IF NEW.studio_id IS NOT NULL AND NOT public.can_edit_studio(auth.uid(),NEW.studio_id) THEN RAISE EXCEPTION 'Studio edit permission required'; END IF;
  IF NEW.project_id IS NOT NULL AND NOT public.can_edit_project(auth.uid(),NEW.project_id) THEN RAISE EXCEPTION 'Project edit permission required'; END IF;
 END IF;
 IF NEW.status <> 'draft' THEN RAISE EXCEPTION 'Only drafts can be saved'; END IF;
 IF jsonb_typeof(NEW.felix_snapshot) IS DISTINCT FROM 'array' THEN RAISE EXCEPTION 'Invalid quote selection'; END IF;
 IF jsonb_array_length(NEW.felix_snapshot)=0 THEN RAISE EXCEPTION 'Select at least one piece'; END IF;
 FOR card IN SELECT value FROM jsonb_array_elements(NEW.felix_snapshot) LOOP
  IF card->>'savedQuoteId' IS DISTINCT FROM NEW.id::text THEN RAISE EXCEPTION 'Invalid quote identifier'; END IF;
  IF card->>'quantity' IS NULL OR (card->>'quantity')::numeric < 1 OR (card->>'quantity')::numeric <> trunc((card->>'quantity')::numeric) THEN RAISE EXCEPTION 'Quantity must be a positive whole number'; END IF;
  IF card->>'unitPriceCents' IS NOT NULL AND ((card->>'unitPriceCents')::numeric < 0 OR (card->>'unitPriceCents')::numeric <> trunc((card->>'unitPriceCents')::numeric)) THEN RAISE EXCEPTION 'Invalid price'; END IF;
  IF card->>'priceCurrency' IS NULL OR card->>'priceCurrency' !~ '^[A-Z]{3}$' THEN RAISE EXCEPTION 'Invalid currency'; END IF;
  IF NOT EXISTS(SELECT 1 FROM public.trade_products WHERE (id=(card->>'productId')::uuid OR source_pick_id=(card->>'productId')::uuid) AND NOT COALESCE(is_hidden,false)) THEN RAISE EXCEPTION 'Product unavailable in trade'; END IF;
 END LOOP;
 RETURN NEW;
END; $$;
CREATE TRIGGER validate_felix_quote_snapshot BEFORE INSERT OR UPDATE OF felix_snapshot ON public.trade_quotes FOR EACH ROW EXECUTE FUNCTION public.validate_felix_quote_snapshot();