ALTER TABLE public.trade_quotes ADD COLUMN revision_of_quote_id uuid REFERENCES public.trade_quotes(id);
CREATE UNIQUE INDEX trade_quotes_one_revision ON public.trade_quotes(revision_of_quote_id) WHERE revision_of_quote_id IS NOT NULL;
COMMENT ON COLUMN public.trade_quotes.revision_of_quote_id IS 'Previous issued quote retained unchanged when an administrator creates an editable revision.';
CREATE OR REPLACE FUNCTION public.guard_procurement_quote_archive() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE allowed text[]:=ARRAY['status','updated_at','admin_notes','responded_at','confirmed_at','credit_applied_cents','client_pdf_path','client_pdf_updated_at','client_pdf_download_token'];
BEGIN
 IF TG_OP='UPDATE' AND OLD.procurement_issued_at IS NOT NULL THEN
  IF public.has_role(auth.uid(),'admin') AND current_setting('ma.quote_pricing_id',true)=OLD.id::text AND OLD.status IN ('submitted','priced') AND NEW.status='priced' THEN allowed:=allowed||ARRAY['landed_cost_cbm','landed_cost_kg','landed_cost_mode']; END IF;
  IF (to_jsonb(NEW)-allowed) IS DISTINCT FROM (to_jsonb(OLD)-allowed) THEN RAISE EXCEPTION 'Issued procurement document is read-only'; END IF;
  IF NEW.status='draft' THEN RAISE EXCEPTION 'Issued procurement document cannot return to draft'; END IF;
 ELSIF TG_OP='UPDATE' AND OLD.status='draft' AND NEW.status='submitted' THEN NEW.procurement_issued_at:=now();
 ELSIF NEW.procurement_issued_at IS NOT NULL THEN RAISE EXCEPTION 'Procurement issuance requires finalizing a draft'; END IF;
 RETURN NEW;
END $$;
CREATE OR REPLACE FUNCTION public.guard_procurement_archive_line() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE issued timestamptz; pricing boolean:=false;
BEGIN
 IF TG_OP='UPDATE' THEN pricing:=public.has_role(auth.uid(),'admin') AND current_setting('ma.quote_pricing_id',true)=OLD.quote_id::text AND (to_jsonb(NEW)-ARRAY['unit_price_cents','unit_price_currency']) IS NOT DISTINCT FROM (to_jsonb(OLD)-ARRAY['unit_price_cents','unit_price_currency']); END IF;
 IF TG_OP<>'INSERT' THEN
  SELECT procurement_issued_at INTO issued FROM public.trade_quotes WHERE id=OLD.quote_id FOR UPDATE;
  IF issued IS NOT NULL AND auth.role() IS DISTINCT FROM 'service_role' AND NOT pricing THEN RAISE EXCEPTION 'Issued procurement line items are read-only'; END IF;
 END IF;
 IF TG_OP<>'DELETE' THEN
  SELECT procurement_issued_at INTO issued FROM public.trade_quotes WHERE id=NEW.quote_id FOR UPDATE;
  IF issued IS NOT NULL AND auth.role() IS DISTINCT FROM 'service_role' AND NOT pricing THEN RAISE EXCEPTION 'Issued procurement line items are read-only'; END IF;
  RETURN NEW;
 END IF;
 RETURN OLD;
END $$;
CREATE FUNCTION public.admin_save_quote_pricing(_quote_id uuid,_lines jsonb,_notes text,_cbm numeric,_kg numeric,_mode text) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE q public.trade_quotes; line record; supplied integer;
BEGIN
 IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'Administrator access required'; END IF;
 SELECT * INTO q FROM public.trade_quotes WHERE id=_quote_id FOR UPDATE;
 IF q.id IS NULL OR q.status NOT IN ('submitted','priced') THEN RAISE EXCEPTION 'Quote is not awaiting pricing'; END IF;
 IF EXISTS(SELECT 1 FROM public.trade_quotes WHERE revision_of_quote_id=q.id) THEN RAISE EXCEPTION 'Price the current revision instead'; END IF;
 IF jsonb_typeof(_lines) IS DISTINCT FROM 'array' OR jsonb_array_length(_lines)=0 THEN RAISE EXCEPTION 'Provide every quote line price'; END IF;
 IF _mode NOT IN ('road','courier') OR _mode IS NULL OR _cbm IS NULL OR _kg IS NULL OR _cbm<0 OR _kg<0 THEN RAISE EXCEPTION 'Invalid landed-cost settings'; END IF;
 SELECT count(DISTINCT id) INTO supplied FROM jsonb_to_recordset(_lines) AS x(id uuid,cents bigint);
 IF supplied<>jsonb_array_length(_lines) OR supplied<>(SELECT count(*) FROM public.trade_quote_items WHERE quote_id=q.id) THEN RAISE EXCEPTION 'Quote lines changed; reload before pricing'; END IF;
 PERFORM set_config('ma.quote_pricing_id',q.id::text,true);
 FOR line IN SELECT * FROM jsonb_to_recordset(_lines) AS x(id uuid,cents bigint) LOOP
  IF line.cents IS NULL OR line.cents<0 OR NOT EXISTS(SELECT 1 FROM public.trade_quote_items WHERE id=line.id AND quote_id=q.id) THEN RAISE EXCEPTION 'Invalid quote line price'; END IF;
  UPDATE public.trade_quote_items SET unit_price_cents=line.cents,unit_price_currency=q.currency WHERE id=line.id AND quote_id=q.id;
 END LOOP;
 UPDATE public.trade_quotes SET status='priced',admin_notes=_notes,responded_at=now(),landed_cost_cbm=_cbm,landed_cost_kg=_kg,landed_cost_mode=_mode WHERE id=q.id;
 PERFORM set_config('ma.quote_pricing_id','',true);
 RETURN q.id;
END $$;
CREATE FUNCTION public.admin_revise_quote(_quote_id uuid,_notes text) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE q public.trade_quotes; draft_id uuid; line public.trade_quote_items; new_line uuid;
BEGIN
 IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'Administrator access required'; END IF;
 SELECT * INTO q FROM public.trade_quotes WHERE id=_quote_id FOR UPDATE;
 IF q.id IS NULL OR q.status NOT IN ('draft','submitted','priced') THEN RAISE EXCEPTION 'Quote cannot be revised in its current state'; END IF;
 SELECT id INTO draft_id FROM public.trade_quotes WHERE revision_of_quote_id=q.id;
 IF draft_id IS NOT NULL THEN RETURN draft_id; END IF;
 IF q.procurement_issued_at IS NULL THEN
  UPDATE public.trade_quotes SET status='draft',submitted_at=NULL,responded_at=NULL,admin_notes=_notes WHERE id=q.id;
  RETURN q.id;
 END IF;
 INSERT INTO public.trade_quotes(user_id,studio_id,project_id,status,currency,client_id,client_name,notes,admin_notes,insurance_enabled,insurance_tier,insurance_rate_bps,insurance_notes,landed_cost_cbm,landed_cost_kg,landed_cost_mode,ship_to_same_as_bill,incoterm,ship_to_name,ship_to_attention,ship_to_address1,ship_to_address2,ship_to_city,ship_to_state,ship_to_postal_code,ship_to_country,ship_to_phone,ship_to_email,ship_to_notes,billing_mode,payer_type,commission_pct,net_discount_pct,end_client_billing,designer_payout_account_id,resale_certificate_id,quote_kind,exchange_rate_at_creation,exchange_rate_locked_at,exchange_rate_base_currency,ceiling_ledger_mode,target_ceiling_cents,ceiling_currency,client_markup_pct,ceiling_trade_discount_pct,ceiling_tier_label,pdf_locale,felix_snapshot,revision_of_quote_id)
 VALUES(q.user_id,q.studio_id,q.project_id,'draft',q.currency,q.client_id,q.client_name,q.notes,_notes,q.insurance_enabled,q.insurance_tier,q.insurance_rate_bps,q.insurance_notes,q.landed_cost_cbm,q.landed_cost_kg,q.landed_cost_mode,q.ship_to_same_as_bill,q.incoterm,q.ship_to_name,q.ship_to_attention,q.ship_to_address1,q.ship_to_address2,q.ship_to_city,q.ship_to_state,q.ship_to_postal_code,q.ship_to_country,q.ship_to_phone,q.ship_to_email,q.ship_to_notes,q.billing_mode,q.payer_type,q.commission_pct,q.net_discount_pct,q.end_client_billing,q.designer_payout_account_id,q.resale_certificate_id,q.quote_kind,q.exchange_rate_at_creation,q.exchange_rate_locked_at,q.exchange_rate_base_currency,q.ceiling_ledger_mode,q.target_ceiling_cents,q.ceiling_currency,q.client_markup_pct,q.ceiling_trade_discount_pct,q.ceiling_tier_label,q.pdf_locale,q.felix_snapshot,q.id) RETURNING id INTO draft_id;
 FOR line IN SELECT * FROM public.trade_quote_items WHERE quote_id=q.id ORDER BY created_at,id LOOP
  INSERT INTO public.trade_quote_items(quote_id,product_id,quantity,unit_price_cents,unit_price_currency,notes,image_url,axonometric_image_url,po_number,cost_code,lead_time_weeks_override,deposit_pct_override,variant_label,room,ship_origin_country,ship_mode,ship_cbm,ship_weight_kg,internal_notes,fabric_id,fabric_meters,fabric_upcharge_cents,fabric_currency,wood_fabric_id,required_by_date,crating_cents,crating_currency)
  VALUES(draft_id,line.product_id,line.quantity,line.unit_price_cents,line.unit_price_currency,line.notes,line.image_url,line.axonometric_image_url,line.po_number,line.cost_code,line.lead_time_weeks_override,line.deposit_pct_override,line.variant_label,line.room,line.ship_origin_country,line.ship_mode,line.ship_cbm,line.ship_weight_kg,line.internal_notes,line.fabric_id,line.fabric_meters,line.fabric_upcharge_cents,line.fabric_currency,line.wood_fabric_id,line.required_by_date,line.crating_cents,line.crating_currency) RETURNING id INTO new_line;
  UPDATE public.client_board_items b SET source_quote_item_id=new_line,procurement_quote_id=draft_id WHERE b.source_quote_item_id=line.id AND (b.procurement_quote_id IS NULL OR b.procurement_quote_id=q.id) AND EXISTS(SELECT 1 FROM public.client_boards cb WHERE cb.id=b.board_id AND cb.project_id IS NOT DISTINCT FROM q.project_id);
 END LOOP;
 UPDATE public.trade_quotes SET project_board_id=q.project_board_id WHERE id=draft_id;
 RETURN draft_id;
END $$;
REVOKE ALL ON FUNCTION public.admin_save_quote_pricing(uuid,jsonb,text,numeric,numeric,text),public.admin_revise_quote(uuid,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.admin_save_quote_pricing(uuid,jsonb,text,numeric,numeric,text),public.admin_revise_quote(uuid,text) TO authenticated;