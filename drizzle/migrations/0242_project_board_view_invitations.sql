ALTER TABLE public.board_invites ADD COLUMN IF NOT EXISTS view_only boolean NOT NULL DEFAULT false;
CREATE OR REPLACE FUNCTION public.create_project_board_view_invite(_project_id uuid, _board_id uuid, _email text) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO public AS $fn$
DECLARE result jsonb;
BEGIN
 IF NOT public.can_manage_board(_board_id) OR NOT EXISTS(SELECT 1 FROM public.client_boards WHERE id=_board_id AND project_id=_project_id) THEN RAISE EXCEPTION 'Project board access required'; END IF;
 result := public.create_board_invite(_board_id, _email, 'client');
 UPDATE public.board_invites SET view_only=true WHERE id=(result->>'id')::uuid;
 RETURN result;
END $fn$;
REVOKE ALL ON FUNCTION public.create_project_board_view_invite(uuid,uuid,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_project_board_view_invite(uuid,uuid,text) TO authenticated;
DO $change$
DECLARE definition text;
BEGIN
 SELECT pg_get_functiondef('public.submit_board_feedback(text,uuid,text,text)'::regprocedure) INTO definition;
 definition := replace(definition, 'IF inv.id IS NULL THEN RAISE EXCEPTION ''Invalid link''; END IF;', 'IF inv.id IS NULL THEN RAISE EXCEPTION ''Invalid link''; END IF; IF inv.view_only THEN RAISE EXCEPTION ''View-only invitation''; END IF;');
 EXECUTE definition;
 SELECT pg_get_functiondef('public.get_shared_board(text)'::regprocedure) INTO definition;
 definition := replace(definition, '''role'', inv.role,', '''view_only'', inv.view_only, ''role'', inv.role,');
 EXECUTE definition;
END $change$;