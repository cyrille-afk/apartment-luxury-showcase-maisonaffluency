CREATE OR REPLACE FUNCTION public.list_curator_pick_versions(_pick_id uuid DEFAULT NULL, _designer_id uuid DEFAULT NULL)
RETURNS TABLE(audit_id uuid, pick_id uuid, operation text, created_at timestamptz, changed_by uuid, snapshot jsonb)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin')) THEN
    RAISE EXCEPTION 'not authorized';
  END IF;
  RETURN QUERY
  SELECT c.id, c.record_id::uuid, c.operation::text, c.created_at, c.changed_by::uuid,
         CASE WHEN c.operation='DELETE' THEN coalesce(c.old_data, c.new_data)::jsonb ELSE coalesce(c.new_data, c.old_data)::jsonb END
  FROM public.content_audit_log c
  WHERE c.table_name = 'designer_curator_picks'
    AND (_pick_id IS NULL OR c.record_id::text = _pick_id::text)
    AND (_designer_id IS NULL OR (CASE WHEN c.operation='DELETE' THEN coalesce(c.old_data, c.new_data) ELSE coalesce(c.new_data, c.old_data) END)::jsonb->>'designer_id' = _designer_id::text)
    AND (_pick_id IS NOT NULL OR c.operation = 'DELETE')
  ORDER BY c.created_at DESC
  LIMIT 200;
END $$;

CREATE OR REPLACE FUNCTION public.restore_curator_pick_version(_audit_id uuid)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _snap jsonb; _id uuid; _cols text;
BEGIN
  IF NOT (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin')) THEN
    RAISE EXCEPTION 'not authorized';
  END IF;
  SELECT CASE WHEN operation='DELETE' THEN coalesce(old_data,new_data)::jsonb ELSE coalesce(new_data,old_data)::jsonb END
    INTO _snap FROM public.content_audit_log
   WHERE id = _audit_id AND table_name = 'designer_curator_picks';
  IF _snap IS NULL THEN RAISE EXCEPTION 'version not found'; END IF;
  _id := (_snap->>'id')::uuid;

  IF EXISTS (SELECT 1 FROM public.designer_curator_picks WHERE id = _id) THEN
    SELECT string_agg(format('%I = r.%I', a.attname, a.attname), ', ') INTO _cols
      FROM pg_attribute a
     WHERE a.attrelid = 'public.designer_curator_picks'::regclass AND a.attnum > 0
       AND NOT a.attisdropped AND a.attgenerated = '' AND a.attname NOT IN ('id','created_at')
       AND _snap ? a.attname;
    EXECUTE format('UPDATE public.designer_curator_picks t SET %s FROM jsonb_populate_record(NULL::public.designer_curator_picks, $1) r WHERE t.id = $2', _cols)
      USING _snap, _id;
  ELSE
    INSERT INTO public.designer_curator_picks
      SELECT (jsonb_populate_record(NULL::public.designer_curator_picks, _snap)).*;
  END IF;
  RETURN _id;
END $$;

REVOKE ALL ON FUNCTION public.list_curator_pick_versions(uuid, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.restore_curator_pick_version(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.list_curator_pick_versions(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.restore_curator_pick_version(uuid) TO authenticated;