CREATE OR REPLACE FUNCTION public.get_shared_workspace(_token text) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,extensions AS $$
DECLARE inv public.board_invites;
BEGIN
inv:=public._board_invite_by_token(_token);
IF inv.id IS NULL OR NOT EXISTS(SELECT 1 FROM public.board_guest_sessions s WHERE s.invite_id=inv.id AND s.expires_at>now() AND s.token_hash=encode(extensions.digest(coalesce(_token,''),'sha256'),'hex')) THEN RETURN NULL; END IF;
RETURN (SELECT presentation FROM public.project_workspace_shares WHERE board_id=inv.board_id AND NOT revoked);
END $$;
REVOKE ALL ON FUNCTION public.get_shared_workspace(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_shared_workspace(text) TO anon,authenticated;
CREATE OR REPLACE FUNCTION public.workspace_read_only_items() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ BEGIN IF EXISTS(SELECT 1 FROM public.project_workspace_shares WHERE board_id=CASE WHEN TG_OP='DELETE' THEN OLD.board_id ELSE NEW.board_id END) THEN RAISE EXCEPTION 'Workspace presentations are read-only'; END IF; IF TG_OP='DELETE' THEN RETURN OLD; END IF; RETURN NEW; END $$;
CREATE TRIGGER workspace_no_feedback_writes BEFORE INSERT OR UPDATE ON public.board_item_feedback FOR EACH ROW EXECUTE FUNCTION public.workspace_read_only_items();
CREATE TRIGGER workspace_no_comment_writes BEFORE INSERT OR UPDATE ON public.client_board_comments FOR EACH ROW EXECUTE FUNCTION public.workspace_read_only_items();
CREATE TRIGGER workspace_no_scene_writes BEFORE INSERT OR UPDATE ON public.board_visualiser_scenes FOR EACH ROW EXECUTE FUNCTION public.workspace_read_only_items();