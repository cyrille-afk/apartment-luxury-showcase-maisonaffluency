CREATE OR REPLACE FUNCTION public.resend_expired_project_board_invite(_project_id uuid, _board_id uuid, _invite_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions AS $$
DECLARE original public.board_invites%ROWTYPE; result jsonb;
BEGIN
 IF auth.uid() IS NULL OR NOT public.can_manage_board(_board_id) OR NOT EXISTS (SELECT 1 FROM public.client_boards WHERE id=_board_id AND project_id=_project_id) THEN RAISE EXCEPTION 'Project board access required'; END IF;
 SELECT * INTO original FROM public.board_invites WHERE id=_invite_id AND board_id=_board_id FOR UPDATE;
 IF NOT FOUND OR original.status='revoked' OR original.expires_at IS NULL OR original.expires_at > now() THEN RAISE EXCEPTION 'An expired invitation is required'; END IF;
 result := public.create_board_invite(_board_id, original.email, original.role);
 UPDATE public.board_invites SET view_only=original.view_only WHERE id=(result->>'id')::uuid;
 UPDATE public.board_invites SET status='revoked' WHERE id=original.id;
 RETURN result || jsonb_build_object('email', original.email);
END $$;
REVOKE ALL ON FUNCTION public.resend_expired_project_board_invite(uuid,uuid,uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.resend_expired_project_board_invite(uuid,uuid,uuid) TO authenticated;