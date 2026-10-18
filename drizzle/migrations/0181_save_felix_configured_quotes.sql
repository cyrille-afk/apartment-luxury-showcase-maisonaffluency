ALTER TABLE public.trade_quotes ADD COLUMN IF NOT EXISTS felix_snapshot jsonb;
CREATE OR REPLACE FUNCTION public.save_felix_quote(p_id uuid, p_studio_id uuid, p_project_id uuid, p_cards jsonb)
RETURNS uuid LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
DECLARE q public.trade_quotes%ROWTYPE; card jsonb; pid uuid; line_id uuid; old_ids uuid[]; new_ids uuid[] := '{}';
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Sign in to save a quote'; END IF;
 IF jsonb_typeof(p_cards) <> 'array' OR jsonb_array_length(p_cards) = 0 THEN RAISE EXCEPTION 'Select at least one piece'; END IF;
 SELECT * INTO q FROM public.trade_quotes WHERE id=p_id FOR UPDATE;
 IF FOUND THEN
  IF q.user_id <> auth.uid() OR q.status <> 'draft' OR q.felix_snapshot IS NULL THEN RAISE EXCEPTION 'Only your Felix drafts can be updated'; END IF;
  SELECT array_agg((x->>'savedLineId')::uuid) INTO old_ids FROM jsonb_array_elements(q.felix_snapshot) x;
 ELSE
  INSERT INTO public.trade_quotes(id,user_id,studio_id,project_id,status,currency,notes,felix_snapshot)
  VALUES(p_id,auth.uid(),p_studio_id,p_project_id,'draft',COALESCE(p_cards->0->>'priceCurrency','EUR'),'Felix configured quote',p_cards) RETURNING * INTO q;
 END IF;
 FOR card IN SELECT value FROM jsonb_array_elements(p_cards) LOOP
  IF (card->>'quantity')::numeric < 1 OR (card->>'quantity')::numeric <> trunc((card->>'quantity')::numeric) THEN RAISE EXCEPTION 'Quantity must be a positive whole number'; END IF;
  SELECT id INTO pid FROM public.trade_products WHERE id=(card->>'productId')::uuid OR source_pick_id=(card->>'productId')::uuid ORDER BY (id=(card->>'productId')::uuid) DESC LIMIT 1;
  IF pid IS NULL THEN RAISE EXCEPTION 'Product not in the trade catalogue'; END IF;
  line_id := (card->>'savedLineId')::uuid;
  IF line_id IS NULL OR line_id=ANY(new_ids) THEN RAISE EXCEPTION 'Invalid quote line identifier'; END IF;
  IF EXISTS(SELECT 1 FROM public.trade_quote_items WHERE id=line_id AND quote_id<>p_id) THEN RAISE EXCEPTION 'Line belongs to another quote'; END IF;
  new_ids := array_append(new_ids,line_id);
  INSERT INTO public.trade_quote_items(id,quote_id,product_id,quantity,unit_price_cents,unit_price_currency,variant_label,notes,image_url)
  VALUES(line_id,p_id,pid,(card->>'quantity')::integer,(card->>'unitPriceCents')::integer,card->>'priceCurrency',NULLIF(concat_ws(' · ',NULLIF(card->>'fabricLabel',''),NULLIF(card->>'baseLabel',''),NULLIF(card->>'topLabel','')),''),NULLIF(concat_ws(' · ',CASE WHEN card->>'fabricLabel' IS NOT NULL THEN 'Fabric: '||(card->>'fabricLabel') END,CASE WHEN card->>'baseLabel' IS NOT NULL THEN 'Base: '||(card->>'baseLabel') END,CASE WHEN card->>'topLabel' IS NOT NULL THEN 'Top: '||(card->>'topLabel') END),''),card->>'imageUrl')
  ON CONFLICT(id) DO UPDATE SET product_id=EXCLUDED.product_id,quantity=EXCLUDED.quantity,unit_price_cents=EXCLUDED.unit_price_cents,unit_price_currency=EXCLUDED.unit_price_currency,variant_label=EXCLUDED.variant_label,notes=EXCLUDED.notes,image_url=EXCLUDED.image_url;
 END LOOP;
 DELETE FROM public.trade_quote_items WHERE quote_id=p_id AND id=ANY(old_ids) AND NOT(id=ANY(new_ids));
 UPDATE public.trade_quotes SET felix_snapshot=p_cards WHERE id=p_id;
 RETURN p_id;
END; $$;
REVOKE ALL ON FUNCTION public.save_felix_quote(uuid,uuid,uuid,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.save_felix_quote(uuid,uuid,uuid,jsonb) TO authenticated,service_role;