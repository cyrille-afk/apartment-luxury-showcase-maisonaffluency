CREATE OR REPLACE FUNCTION public.list_curator_pick_versions(_pick_id uuid DEFAULT NULL, _designer_id uuid DEFAULT NULL)
RETURNS TABLE(audit_id uuid, pick_id uuid, operation text, created_at timestamptz, changed_by uuid, snapshot jsonb)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin')) THEN
    RAISE EXCEPTION 'not authorized';
  END IF;
  IF _pick_id IS NOT NULL THEN
    RETURN QUERY
    SELECT c.id, c.record_id, c.operation::text, c.created_at, c.changed_by::uuid,
           CASE WHEN c.operation='DELETE' THEN coalesce(c.old_data, c.new_data)::jsonb ELSE coalesce(c.new_data, c.old_data)::jsonb END
    FROM public.content_audit_log c
    WHERE c.record_id = _pick_id AND c.table_name = 'designer_curator_picks'
    ORDER BY c.created_at DESC LIMIT 300;
  ELSE
    RETURN QUERY
    SELECT c.id, c.record_id, c.operation::text, c.created_at, c.changed_by::uuid,
           coalesce(c.old_data, c.new_data)::jsonb
    FROM public.content_audit_log c
    WHERE c.table_name = 'designer_curator_picks' AND c.operation = 'DELETE'
      AND coalesce(c.old_data, c.new_data)::jsonb->>'designer_id' = _designer_id::text
    ORDER BY c.created_at DESC LIMIT 200;
  END IF;
END $$;