CREATE OR REPLACE FUNCTION public.create_project_board_client_invite(_project_id uuid, _board_id uuid, _email text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO public AS $fn$
BEGIN
 IF auth.uid() IS NULL OR NOT public.can_edit_project(auth.uid(), _project_id) OR NOT public.can_manage_board(_board_id) OR NOT EXISTS (SELECT 1 FROM public.client_boards WHERE id = _board_id AND project_id = _project_id) THEN
   RAISE EXCEPTION 'Project board access required';
 END IF;
 RETURN public.create_board_invite(_board_id, _email, 'client');
END;
$fn$;
REVOKE ALL ON FUNCTION public.create_project_board_client_invite(uuid,uuid,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_project_board_client_invite(uuid,uuid,text) TO authenticated;
COMMENT ON FUNCTION public.create_project_board_client_invite(uuid,uuid,text) IS 'Project-scoped client invitation: comment and approve, never contractor editing. Separate from view-only tearsheet sharing.';