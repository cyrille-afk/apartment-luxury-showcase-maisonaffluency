CREATE OR REPLACE FUNCTION public.swap_visualiser_board_item_snapshot(_item_id uuid, _project_id uuid, _product_id uuid, _finish_label text DEFAULT NULL) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _snapshot jsonb;
BEGIN
 IF auth.uid() IS NULL OR NOT public.can_edit_project(auth.uid(), _project_id) THEN RAISE EXCEPTION 'Project edit permission required'; END IF;
 SELECT jsonb_build_object('product_id', i.product_id, 'variant_label', i.variant_label, 'wood_label', i.wood_label, 'fabric_label', i.fabric_label, 'studio_selection', (SELECT f.selection FROM public.project_studio_finishes f WHERE f.project_id = _project_id AND f.item_key = _item_id::text)) INTO _snapshot FROM public.client_board_items i JOIN public.client_boards b ON b.id = i.board_id WHERE i.id = _item_id AND b.project_id = _project_id AND i.procurement_quote_id IS NULL AND i.source_quote_item_id IS NULL FOR UPDATE OF i;
 IF _snapshot IS NULL THEN RAISE EXCEPTION 'Editable specification item required'; END IF;
 PERFORM public.swap_visualiser_board_item(_item_id, _project_id, _product_id, _finish_label);
 RETURN _snapshot;
END; $$;
CREATE OR REPLACE FUNCTION public.undo_visualiser_board_item_swap(_item_id uuid, _project_id uuid, _expected_product_id uuid, _snapshot jsonb) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _current uuid;
BEGIN
 IF auth.uid() IS NULL OR NOT public.can_edit_project(auth.uid(), _project_id) THEN RAISE EXCEPTION 'Project edit permission required'; END IF;
 SELECT i.product_id INTO _current FROM public.client_board_items i JOIN public.client_boards b ON b.id = i.board_id WHERE i.id = _item_id AND b.project_id = _project_id AND i.procurement_quote_id IS NULL AND i.source_quote_item_id IS NULL FOR UPDATE OF i;
 IF _current IS NULL OR _current IS DISTINCT FROM _expected_product_id OR EXISTS (SELECT 1 FROM public.project_studio_finishes f WHERE f.project_id = _project_id AND f.item_key = _item_id::text) THEN RAISE EXCEPTION 'Specification changed since this swap'; END IF;
 IF NOT EXISTS (SELECT 1 FROM public.trade_products WHERE id = (_snapshot->>'product_id')::uuid) THEN RAISE EXCEPTION 'Original catalogue product required'; END IF;
 UPDATE public.client_board_items SET product_id = (_snapshot->>'product_id')::uuid, variant_label = _snapshot->>'variant_label', wood_label = _snapshot->>'wood_label', fabric_label = _snapshot->>'fabric_label' WHERE id = _item_id;
 IF jsonb_typeof(_snapshot->'studio_selection') = 'object' THEN
 INSERT INTO public.project_studio_finishes(project_id, item_key, selection, updated_by) VALUES (_project_id, _item_id::text, _snapshot->'studio_selection', auth.uid());
 END IF;
END; $$;
REVOKE ALL ON FUNCTION public.swap_visualiser_board_item_snapshot(uuid, uuid, uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.undo_visualiser_board_item_swap(uuid, uuid, uuid, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.swap_visualiser_board_item_snapshot(uuid, uuid, uuid, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.undo_visualiser_board_item_swap(uuid, uuid, uuid, jsonb) TO authenticated, service_role;