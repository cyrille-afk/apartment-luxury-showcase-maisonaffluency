CREATE FUNCTION public.admin_revise_quote_with_result(_quote_id uuid,_notes text) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE existing_id uuid; draft_id uuid;
BEGIN
 IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'Administrator access required'; END IF;
 PERFORM 1 FROM public.trade_quotes WHERE id=_quote_id FOR UPDATE;
 SELECT id INTO existing_id FROM public.trade_quotes WHERE revision_of_quote_id=_quote_id;
 draft_id := public.admin_revise_quote(_quote_id,_notes);
 RETURN jsonb_build_object('draft_id',draft_id,'created',existing_id IS NULL AND draft_id<>_quote_id);
END $$;
REVOKE ALL ON FUNCTION public.admin_revise_quote_with_result(uuid,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.admin_revise_quote_with_result(uuid,text) TO authenticated;