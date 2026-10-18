CREATE TABLE public.curated_pairing_history (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 created_at timestamptz NOT NULL DEFAULT now(),
 rule_id uuid,
 batch_id uuid,
 action text NOT NULL CHECK (action IN ('created','updated','deleted','csv_import')),
 source text NOT NULL CHECK (source IN ('editor','csv','system')),
 actor_id uuid,
 actor_name text NOT NULL,
 actor_email text,
 file_name text,
 imported_count integer,
 before_values jsonb,
 after_values jsonb
);
GRANT SELECT ON public.curated_pairing_history TO authenticated;
GRANT ALL ON public.curated_pairing_history TO service_role;
ALTER TABLE public.curated_pairing_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins read pairing history" ON public.curated_pairing_history FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE INDEX curated_pairing_history_time ON public.curated_pairing_history (created_at DESC, id DESC);
CREATE INDEX curated_pairing_history_batch ON public.curated_pairing_history (batch_id) WHERE batch_id IS NOT NULL;
CREATE FUNCTION public.record_curated_pairing_change() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE previous jsonb; current_values jsonb; actor uuid := auth.uid(); actor_label text; actor_mail text; batch uuid;
BEGIN
 IF TG_OP <> 'INSERT' THEN previous := to_jsonb(OLD); END IF;
 IF TG_OP <> 'DELETE' THEN current_values := to_jsonb(NEW); END IF;
 IF TG_OP = 'UPDATE' AND previous = current_values THEN RETURN NEW; END IF;
 SELECT NULLIF(trim(concat_ws(' ',first_name,last_name)),''), email INTO actor_label,actor_mail FROM public.profiles WHERE id=actor;
 batch := nullif(current_setting('app.pairing_import_batch',true),'')::uuid;
 INSERT INTO public.curated_pairing_history(rule_id,batch_id,action,source,actor_id,actor_name,actor_email,before_values,after_values)
 VALUES(COALESCE(NEW.id,OLD.id),batch,CASE TG_OP WHEN 'INSERT' THEN 'created' WHEN 'DELETE' THEN 'deleted' ELSE 'updated' END,CASE WHEN batch IS NOT NULL THEN 'csv' WHEN actor IS NULL THEN 'system' ELSE 'editor' END,actor,COALESCE(actor_label,actor_mail,actor::text,'System'),actor_mail,previous,current_values);
 IF TG_OP = 'DELETE' THEN RETURN OLD; END IF; RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.record_curated_pairing_change() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER curated_pairing_change_history AFTER INSERT OR UPDATE OR DELETE ON public.curated_pairing_rules FOR EACH ROW EXECUTE FUNCTION public.record_curated_pairing_change();
CREATE FUNCTION public.import_curated_pairing_finishes(updates jsonb, file_name text DEFAULT NULL) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE item jsonb; existing public.curated_pairing_rules%ROWTYPE; batch uuid := gen_random_uuid(); actor uuid := auth.uid(); actor_label text; actor_mail text; seen uuid[] := ARRAY[]::uuid[]; target uuid; old_batch text := current_setting('app.pairing_import_batch',true);
BEGIN
 IF actor IS NULL OR NOT public.has_role(actor,'admin') THEN RAISE EXCEPTION 'Admin access required' USING ERRCODE='42501'; END IF;
 IF jsonb_typeof(updates) IS DISTINCT FROM 'array' OR jsonb_array_length(updates) NOT BETWEEN 1 AND 1000 THEN RAISE EXCEPTION 'Import must contain 1 to 1000 pairings'; END IF;
 PERFORM set_config('app.pairing_import_batch',batch::text,true);
 FOR item IN SELECT value FROM jsonb_array_elements(updates) ORDER BY value->>'id' LOOP
  target := (item->>'id')::uuid;
  IF target IS NULL OR target=ANY(seen) THEN RAISE EXCEPTION 'Invalid or duplicate pairing'; END IF; seen := array_append(seen,target);
  SELECT * INTO existing FROM public.curated_pairing_rules WHERE id=target FOR UPDATE;
  IF NOT FOUND OR to_jsonb(existing) IS DISTINCT FROM item->'before' THEN RAISE EXCEPTION 'A pairing changed after review. Export and review the current catalog again.' USING ERRCODE='40001'; END IF;
  IF NOT public.valid_pairing_finish_options(item->'finish_options') OR item->'finish_options' IS NULL OR item->>'finish_currency' IS NULL THEN RAISE EXCEPTION 'Invalid finish choices or currency'; END IF;
  UPDATE public.curated_pairing_rules SET finish_options=item->'finish_options',finish_currency=item->>'finish_currency' WHERE id=target;
 END LOOP;
 SELECT NULLIF(trim(concat_ws(' ',first_name,last_name)),''), email INTO actor_label,actor_mail FROM public.profiles WHERE id=actor;
 INSERT INTO public.curated_pairing_history(batch_id,action,source,actor_id,actor_name,actor_email,file_name,imported_count)
 VALUES(batch,'csv_import','csv',actor,COALESCE(actor_label,actor_mail,actor::text),actor_mail,left(file_name,255),jsonb_array_length(updates));
 PERFORM set_config('app.pairing_import_batch',COALESCE(old_batch,''),true);
 RETURN jsonb_build_object('batch_id',batch,'updated_count',jsonb_array_length(updates));
END $$;
REVOKE ALL ON FUNCTION public.import_curated_pairing_finishes(jsonb,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.import_curated_pairing_finishes(jsonb,text) TO authenticated;
COMMENT ON TABLE public.curated_pairing_history IS 'Append-only admin catalog history. Recording begins when installed; no fabricated historical entries. Snapshots survive rule deletion.';