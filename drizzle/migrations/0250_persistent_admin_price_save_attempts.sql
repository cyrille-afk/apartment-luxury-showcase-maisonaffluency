CREATE TABLE public.admin_price_save_attempts (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 user_id uuid NOT NULL DEFAULT auth.uid(),
 product_id uuid NOT NULL,
 product_name text NOT NULL,
 field_name text NOT NULL,
 old_data jsonb NOT NULL,
 new_data jsonb NOT NULL,
 status text NOT NULL DEFAULT 'Saving' CHECK (status IN ('Saving','Saved','Failed','Unconfirmed')),
 error_code text,
 created_at timestamptz NOT NULL DEFAULT now(),
 completed_at timestamptz
);
GRANT SELECT ON public.admin_price_save_attempts TO authenticated;
GRANT ALL ON public.admin_price_save_attempts TO service_role;
ALTER TABLE public.admin_price_save_attempts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins read price save attempts" ON public.admin_price_save_attempts FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE INDEX admin_price_attempts_created_idx ON public.admin_price_save_attempts (created_at DESC);
CREATE OR REPLACE FUNCTION public.begin_admin_price_save(_id uuid, _product_id uuid, _field text, _value jsonb)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _snapshot jsonb; _title text;
BEGIN
 IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'Administrator access required' USING ERRCODE='42501'; END IF;
 IF _field NOT IN ('trade_price_cents','price_per_sqm_cents','size_variants','currency','price_prefix') THEN RAISE EXCEPTION 'Unsupported price field'; END IF;
 IF EXISTS (SELECT 1 FROM public.admin_price_save_attempts WHERE id=_id AND user_id=auth.uid()) THEN RETURN _id; END IF;
 SELECT jsonb_build_object('title',title,'currency',currency,'trade_price_cents',trade_price_cents,'price_per_sqm_cents',price_per_sqm_cents,'size_variants',size_variants,'price_prefix',price_prefix),title INTO _snapshot,_title FROM public.designer_curator_picks WHERE id=_product_id;
 IF NOT FOUND THEN RAISE EXCEPTION 'Product unavailable'; END IF;
 INSERT INTO public.admin_price_save_attempts(id,user_id,product_id,product_name,field_name,old_data,new_data) VALUES (_id,auth.uid(),_product_id,_title,_field,_snapshot,_snapshot || jsonb_build_object(_field,_value));
 RETURN _id;
END $$;
REVOKE ALL ON FUNCTION public.begin_admin_price_save(uuid,uuid,text,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.begin_admin_price_save(uuid,uuid,text,jsonb) TO authenticated;
CREATE OR REPLACE FUNCTION public.commit_admin_price_save(_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _attempt public.admin_price_save_attempts; _current jsonb; _count integer; _code text;
BEGIN
 IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'Administrator access required' USING ERRCODE='42501'; END IF;
 SELECT * INTO _attempt FROM public.admin_price_save_attempts WHERE id=_id AND user_id=auth.uid() FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Save attempt unavailable'; END IF;
 IF _attempt.status <> 'Saving' THEN RETURN jsonb_build_object('status',_attempt.status,'error_code',_attempt.error_code); END IF;
 BEGIN
  SELECT to_jsonb(p) INTO _current FROM public.designer_curator_picks p WHERE id=_attempt.product_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Product unavailable' USING ERRCODE='P0002'; END IF;
  IF (_current -> _attempt.field_name) IS DISTINCT FROM (_attempt.old_data -> _attempt.field_name) THEN RAISE EXCEPTION 'Price changed since save started' USING ERRCODE='40001'; END IF;
  EXECUTE format('UPDATE public.designer_curator_picks SET %1$I = (jsonb_populate_record(NULL::public.designer_curator_picks, $1)).%1$I WHERE id=$2', _attempt.field_name) USING _attempt.new_data,_attempt.product_id;
  GET DIAGNOSTICS _count = ROW_COUNT;
  IF _count <> 1 THEN RAISE EXCEPTION 'Save unconfirmed'; END IF;
  UPDATE public.admin_price_save_attempts SET status='Saved',completed_at=now() WHERE id=_id;
  RETURN jsonb_build_object('status','Saved');
 EXCEPTION WHEN OTHERS THEN
  GET STACKED DIAGNOSTICS _code = RETURNED_SQLSTATE;
  UPDATE public.admin_price_save_attempts SET status='Failed',error_code=_code,completed_at=now() WHERE id=_id;
  RETURN jsonb_build_object('status','Failed','error_code',_code);
 END;
END $$;
REVOKE ALL ON FUNCTION public.commit_admin_price_save(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.commit_admin_price_save(uuid) TO authenticated;
COMMENT ON TABLE public.admin_price_save_attempts IS 'Admin-only durable save lifecycle; successful product writes and Saved status commit atomically. Existing content_audit_log remains the authoritative successful price-change history.';