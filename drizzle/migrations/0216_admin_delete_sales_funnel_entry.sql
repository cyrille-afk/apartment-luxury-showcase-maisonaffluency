CREATE OR REPLACE FUNCTION public.admin_delete_sales_funnel_entry(_source text, _id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE target_status text; linked_id uuid; target_paid timestamptz;
BEGIN
 IF auth.uid() IS NULL OR NOT (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin')) THEN
  RAISE EXCEPTION 'Administrator access required' USING ERRCODE = '42501';
 END IF;
 IF _source NOT IN ('cart','inquiry','quote','order','acquisition') OR _source IS NULL OR _id IS NULL THEN RAISE EXCEPTION 'Invalid funnel target'; END IF;
 CASE _source
 WHEN 'cart' THEN SELECT status INTO target_status FROM public.abandoned_carts WHERE id = _id FOR UPDATE;
 WHEN 'inquiry' THEN SELECT status, linked_quote_id INTO target_status, linked_id FROM public.inquiries WHERE id = _id FOR UPDATE;
 WHEN 'quote' THEN SELECT status INTO target_status FROM public.trade_quotes WHERE id = _id FOR UPDATE;
 WHEN 'order' THEN SELECT status, paid_at INTO target_status, target_paid FROM public.shop_orders WHERE id = _id FOR UPDATE;
 WHEN 'acquisition' THEN SELECT campaign_status INTO target_status FROM public.acquisition_leads WHERE id = _id FOR UPDATE;
 END CASE;
 IF target_status IS NULL THEN RAISE EXCEPTION 'Entry no longer exists. Refresh the funnel.'; END IF;
 IF (_source = 'cart' AND target_status <> 'active') OR
    (_source = 'inquiry' AND (target_status NOT IN ('new','in_review') OR linked_id IS NOT NULL OR EXISTS (SELECT 1 FROM public.trade_quotes WHERE source_inquiry_id = _id))) OR
    (_source = 'quote' AND target_status NOT IN ('draft','submitted')) OR
    (_source = 'order' AND (target_status <> 'pending' OR target_paid IS NOT NULL)) OR
    (_source = 'acquisition' AND target_status <> 'portal_activated') THEN
  RAISE EXCEPTION 'This entry has progressed and cannot be deleted from the funnel.';
 END IF;
 PERFORM id FROM public.funnel_card_payments WHERE card_id = _id::text OR (_source = 'quote' AND quote_id = _id) FOR UPDATE;
 IF EXISTS (SELECT 1 FROM public.funnel_card_payments WHERE (card_id = _id::text OR (_source = 'quote' AND quote_id = _id)) AND (stripe_session_id IS NOT NULL OR (stripe_payment_intent_id IS NOT NULL AND stripe_payment_intent_id NOT LIKE 'pi_simulated_%') OR (status IN ('paid','settled') AND (stripe_payment_intent_id IS NULL OR stripe_payment_intent_id NOT LIKE 'pi_simulated_%')))) THEN
  RAISE EXCEPTION 'Payment-linked records are protected. Cancel or resolve the payment first.';
 END IF;
 IF _source = 'quote' THEN
  PERFORM id FROM public.quote_payment_links WHERE quote_id = _id FOR UPDATE;
  IF EXISTS (SELECT 1 FROM public.quote_payment_links WHERE quote_id = _id AND (status = 'paid' OR paid_at IS NOT NULL OR stripe_session_id IS NOT NULL)) THEN RAISE EXCEPTION 'Payment-linked quotations are protected.'; END IF;
 END IF;
 IF _source = 'order' AND EXISTS (SELECT 1 FROM public.shop_orders WHERE id = _id AND stripe_session_id IS NOT NULL) THEN RAISE EXCEPTION 'Payment-linked orders are protected.'; END IF;
 DELETE FROM public.funnel_card_payments WHERE (card_id = _id::text OR (_source = 'quote' AND quote_id = _id)) AND stripe_session_id IS NULL;
 CASE _source
 WHEN 'cart' THEN DELETE FROM public.abandoned_carts WHERE id = _id;
 WHEN 'inquiry' THEN DELETE FROM public.inquiries WHERE id = _id;
 WHEN 'quote' THEN DELETE FROM public.trade_quotes WHERE id = _id;
 WHEN 'order' THEN DELETE FROM public.shop_orders WHERE id = _id;
 WHEN 'acquisition' THEN DELETE FROM public.acquisition_leads WHERE id = _id;
 END CASE;
END;
$$;
REVOKE ALL ON FUNCTION public.admin_delete_sales_funnel_entry(text, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_delete_sales_funnel_entry(text, uuid) TO authenticated;
COMMENT ON FUNCTION public.admin_delete_sales_funnel_entry(text, uuid) IS 'Confirmed admin cleanup of unfinished funnel source records; protects payment-linked records, permits local simulated payments, retains reminder audit history and never deletes user or studio accounts.';