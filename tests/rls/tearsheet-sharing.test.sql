-- View-only invitations cannot mutate board selections; revoked sessions cannot read.
BEGIN;
DO $$
BEGIN
 IF position('inv.view_only' in pg_get_functiondef('public.submit_board_feedback(text,uuid,text,text)'::regprocedure))=0 THEN RAISE EXCEPTION 'View-only feedback guard missing'; END IF;
 IF position('inv.view_only' in pg_get_functiondef('public.approve_shared_room(text)'::regprocedure))=0 THEN RAISE EXCEPTION 'View-only room approval guard missing'; END IF;
 IF position('project_id = _project_id' in replace(pg_get_functiondef('public.create_project_board_view_invite(uuid,uuid,text)'::regprocedure),'project_id=_project_id','project_id = _project_id'))=0 THEN RAISE EXCEPTION 'Project scope guard missing'; END IF;
 IF position('i.status <> ''revoked''' in pg_get_functiondef('public._board_invite_by_token(text)'::regprocedure))=0 THEN RAISE EXCEPTION 'Revoked guest session guard missing'; END IF;
END $$;
ROLLBACK;