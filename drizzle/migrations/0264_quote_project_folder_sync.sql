ALTER TABLE public.trade_quotes ADD COLUMN project_board_id uuid REFERENCES public.client_boards(id) ON DELETE SET NULL;
ALTER TABLE public.client_board_items ADD COLUMN source_quote_item_id uuid REFERENCES public.trade_quote_items(id) ON DELETE SET NULL;
CREATE UNIQUE INDEX client_board_items_quote_source_unique ON public.client_board_items(board_id, source_quote_item_id);

CREATE FUNCTION public.validate_quote_project_folder() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF NEW.project_board_id IS NOT NULL AND (TG_OP='INSERT' OR NEW.project_board_id IS DISTINCT FROM OLD.project_board_id OR NEW.project_id IS DISTINCT FROM OLD.project_id) THEN
  IF auth.uid() IS NULL OR NOT public.can_edit_project(auth.uid(),NEW.project_id) OR NOT public.can_manage_board(NEW.project_board_id) OR NOT EXISTS(SELECT 1 FROM public.client_boards WHERE id=NEW.project_board_id AND project_id=NEW.project_id) THEN RAISE EXCEPTION 'Project folder access required'; END IF;
 END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.validate_quote_project_folder() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER validate_quote_project_folder BEFORE INSERT OR UPDATE OF project_board_id,project_id ON public.trade_quotes FOR EACH ROW EXECUTE FUNCTION public.validate_quote_project_folder();

CREATE FUNCTION public.sync_quote_project_folder(_quote_id uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE _board_id uuid; _owner uuid; _item record; _sort integer;
BEGIN
 SELECT q.project_board_id,q.user_id INTO _board_id,_owner FROM public.trade_quotes q JOIN public.client_boards b ON b.id=q.project_board_id AND b.project_id=q.project_id WHERE q.id=_quote_id;
 IF _board_id IS NULL THEN RETURN; END IF;
 PERFORM 1 FROM public.client_boards WHERE id=_board_id FOR UPDATE;
 FOR _item IN SELECT i.id,i.product_id,i.variant_label,f.name AS fabric_label,w.name AS wood_label FROM public.trade_quote_items i LEFT JOIN public.fabrics f ON f.id=i.fabric_id LEFT JOIN public.fabrics w ON w.id=i.wood_fabric_id WHERE i.quote_id=_quote_id ORDER BY i.created_at,i.id LOOP
  -- Adopt only an identical, unlinked selection; a different finish remains a separate piece.
  UPDATE public.client_board_items SET source_quote_item_id=_item.id WHERE id=(SELECT id FROM public.client_board_items WHERE board_id=_board_id AND product_id=_item.product_id AND variant_label IS NOT DISTINCT FROM _item.variant_label AND source_quote_item_id IS NULL ORDER BY sort_order,id LIMIT 1) AND NOT EXISTS(SELECT 1 FROM public.client_board_items WHERE board_id=_board_id AND source_quote_item_id=_item.id);
  SELECT COALESCE(MAX(sort_order),-1)+1 INTO _sort FROM public.client_board_items WHERE board_id=_board_id;
  INSERT INTO public.client_board_items(board_id,product_id,variant_label,fabric_label,wood_label,sort_order,source_quote_item_id,added_by)
  VALUES(_board_id,_item.product_id,_item.variant_label,_item.fabric_label,_item.wood_label,_sort,_item.id,_owner)
  ON CONFLICT(board_id,source_quote_item_id) DO UPDATE SET product_id=EXCLUDED.product_id,variant_label=EXCLUDED.variant_label,fabric_label=EXCLUDED.fabric_label,wood_label=EXCLUDED.wood_label;
 END LOOP;
END $$;
REVOKE ALL ON FUNCTION public.sync_quote_project_folder(uuid) FROM PUBLIC,anon,authenticated;

CREATE FUNCTION public.trigger_quote_project_folder_sync() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF TG_TABLE_NAME='trade_quotes' THEN PERFORM public.sync_quote_project_folder(NEW.id); ELSE PERFORM public.sync_quote_project_folder(NEW.quote_id); END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.trigger_quote_project_folder_sync() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER sync_quote_linked_folder AFTER INSERT OR UPDATE OF project_board_id,project_id ON public.trade_quotes FOR EACH ROW EXECUTE FUNCTION public.trigger_quote_project_folder_sync();
CREATE TRIGGER sync_quote_item_linked_folder AFTER INSERT OR UPDATE OF product_id,variant_label,fabric_id,wood_fabric_id ON public.trade_quote_items FOR EACH ROW EXECUTE FUNCTION public.trigger_quote_project_folder_sync();

CREATE FUNCTION public.link_quote_project_folder(_quote_id uuid,_project_id uuid,_board_id uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE _q public.trade_quotes;
BEGIN
 SELECT * INTO _q FROM public.trade_quotes WHERE id=_quote_id FOR UPDATE;
 IF auth.uid() IS NULL OR _q.id IS NULL OR NOT (public.has_role(auth.uid(),'admin') OR (_q.user_id=auth.uid() AND public.has_role(auth.uid(),'trade_user')) OR (_q.project_id IS NOT NULL AND public.can_edit_project(auth.uid(),_q.project_id))) OR NOT public.can_edit_project(auth.uid(),_project_id) OR NOT public.can_manage_board(_board_id) OR NOT EXISTS(SELECT 1 FROM public.client_boards WHERE id=_board_id AND project_id=_project_id) THEN RAISE EXCEPTION 'Quote and project folder access required'; END IF;
 IF _q.project_id IS NOT NULL AND _q.project_id IS DISTINCT FROM _project_id THEN RAISE EXCEPTION 'Quote belongs to another project'; END IF;
 IF _q.project_board_id IS NOT NULL AND _q.project_board_id IS DISTINCT FROM _board_id THEN RAISE EXCEPTION 'Quote already linked to another folder'; END IF;
 UPDATE public.trade_quotes SET project_id=_project_id,project_board_id=_board_id WHERE id=_quote_id;
END $$;
REVOKE ALL ON FUNCTION public.link_quote_project_folder(uuid,uuid,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.link_quote_project_folder(uuid,uuid,uuid) TO authenticated;

CREATE FUNCTION public.create_quote_project_client_invite(_quote_id uuid,_project_id uuid,_board_id uuid,_email text) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE _invite jsonb;
BEGIN
 PERFORM public.link_quote_project_folder(_quote_id,_project_id,_board_id);
 _invite := public.create_project_board_client_invite(_project_id,_board_id,_email);
 RETURN _invite;
END $$;
REVOKE ALL ON FUNCTION public.create_quote_project_client_invite(uuid,uuid,uuid,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.create_quote_project_client_invite(uuid,uuid,uuid,text) TO authenticated;
COMMENT ON COLUMN public.trade_quotes.project_board_id IS 'Explicit quote destination folder; configured product additions sync through database triggers. Board projection excludes quote pricing and notes.';