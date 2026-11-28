CREATE FUNCTION public.append_residence_eye_level_shell(_layout_id uuid, _shell jsonb) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'Admin access required'; END IF;
 IF jsonb_typeof(_shell) IS DISTINCT FROM 'object' OR length(btrim(coalesce(_shell->>'label',''))) NOT BETWEEN 1 AND 120 OR coalesce(_shell->>'url','') NOT LIKE 'https://%' OR length(_shell->>'url') > 2048 THEN RAISE EXCEPTION 'Invalid residence view'; END IF;
 UPDATE public.residence_layouts SET eye_level_shell_urls = eye_level_shell_urls || jsonb_build_array(jsonb_build_object('label',_shell->>'label','url',_shell->>'url')) WHERE id=_layout_id AND NOT EXISTS (SELECT 1 FROM jsonb_array_elements(eye_level_shell_urls) s WHERE s->>'url'=_shell->>'url');
 IF NOT FOUND AND NOT EXISTS (SELECT 1 FROM public.residence_layouts WHERE id=_layout_id) THEN RAISE EXCEPTION 'Residence not found'; END IF;
END $$;
REVOKE ALL ON FUNCTION public.append_residence_eye_level_shell(uuid,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.append_residence_eye_level_shell(uuid,jsonb) TO authenticated;