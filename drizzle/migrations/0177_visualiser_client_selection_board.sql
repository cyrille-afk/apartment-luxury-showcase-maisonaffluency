CREATE OR REPLACE FUNCTION public.create_visualiser_client_board(_title text, _client_id uuid, _project_id uuid, _studio_id uuid, _studio_name text, _studio_logo_url text, _hide_maison_branding boolean, _items jsonb)
RETURNS uuid LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $function$
DECLARE _board uuid; _client_name text; _client_email text; _item jsonb; _product uuid; _sort smallint := 0;
BEGIN
  IF auth.uid() IS NULL OR NOT (public.has_role(auth.uid(), 'trade_user'::public.app_role) OR public.has_role(auth.uid(), 'admin'::public.app_role)) THEN RAISE EXCEPTION 'Trade membership required'; END IF;
  IF length(trim(coalesce(_title,''))) NOT BETWEEN 1 AND 120 THEN RAISE EXCEPTION 'Enter a board title'; END IF;
  IF jsonb_typeof(_items) IS DISTINCT FROM 'array' OR jsonb_array_length(_items) NOT BETWEEN 1 AND 15 THEN RAISE EXCEPTION 'Select between 1 and 15 pieces'; END IF;
  IF _project_id IS NOT NULL AND NOT public.can_edit_project(auth.uid(), _project_id) THEN RAISE EXCEPTION 'Project access required'; END IF;
  IF _studio_id IS NOT NULL AND NOT public.can_edit_studio(auth.uid(), _studio_id) THEN RAISE EXCEPTION 'Studio access required'; END IF;
  IF _client_id IS NOT NULL THEN
    SELECT name INTO _client_name FROM public.clients WHERE id = _client_id AND (studio_id = _studio_id OR user_id = auth.uid());
    IF _client_name IS NULL THEN RAISE EXCEPTION 'Client unavailable'; END IF;
    SELECT email INTO _client_email FROM public.client_contacts WHERE client_id = _client_id AND is_primary ORDER BY created_at LIMIT 1;
  END IF;
  INSERT INTO public.client_boards(user_id,title,client_id,client_name,client_email,project_id,studio_id,studio_name,studio_logo_url,hide_maison_branding,source)
  VALUES(auth.uid(),trim(_title),_client_id,coalesce(_client_name,''),_client_email,_project_id,_studio_id,nullif(left(trim(_studio_name),120),''),nullif(_studio_logo_url,''),coalesce(_hide_maison_branding,true),'visualiser') RETURNING id INTO _board;
  FOR _item IN SELECT value FROM jsonb_array_elements(_items) LOOP
    _product := NULL;
    SELECT id INTO _product FROM public.trade_products WHERE (id = (_item->>'product_id')::uuid OR source_pick_id = (_item->>'product_id')::uuid) AND is_active IS NOT FALSE AND is_hidden IS NOT TRUE ORDER BY (id = (_item->>'product_id')::uuid) DESC LIMIT 1;
    IF _product IS NULL THEN RAISE EXCEPTION 'A selected piece is unavailable'; END IF;
    INSERT INTO public.client_board_items(board_id,product_id,sort_order,fabric_label,wood_label,variant_label,added_by,saved_via)
    VALUES(_board,_product,_sort,nullif(left(_item->>'fabric_label',255),''),nullif(left(_item->>'wood_label',255),''),nullif(left(_item->>'variant_label',500),''),auth.uid(),'visualiser');
    _sort := _sort + 1;
  END LOOP;
  RETURN _board;
END $function$;
REVOKE ALL ON FUNCTION public.create_visualiser_client_board(text,uuid,uuid,uuid,text,text,boolean,jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_visualiser_client_board(text,uuid,uuid,uuid,text,text,boolean,jsonb) TO authenticated;
COMMENT ON FUNCTION public.create_visualiser_client_board(text,uuid,uuid,uuid,text,text,boolean,jsonb) IS 'Atomic Visualiser selection export into existing private client boards, preserving caller RLS and existing email-verified review.';