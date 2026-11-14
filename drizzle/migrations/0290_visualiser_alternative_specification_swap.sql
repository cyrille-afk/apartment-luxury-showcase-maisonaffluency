CREATE OR REPLACE FUNCTION public.swap_visualiser_board_item(
  _item_id uuid,
  _project_id uuid,
  _product_id uuid,
  _finish_label text DEFAULT NULL
)
RETURNS TABLE(item_id uuid, product_id uuid, variant_label text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _board_id uuid;
BEGIN
  IF auth.uid() IS NULL OR NOT public.can_edit_project(auth.uid(), _project_id) THEN
    RAISE EXCEPTION 'Project edit permission required';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.trade_products p
    WHERE p.id = _product_id AND p.is_active = true AND p.is_hidden = false
      AND p.glb_url IS NOT NULL AND btrim(p.glb_url) <> ''
  ) THEN
    RAISE EXCEPTION 'Active 3D catalogue product required';
  END IF;

  SELECT i.board_id INTO _board_id
  FROM public.client_board_items i
  JOIN public.client_boards b ON b.id = i.board_id
  WHERE i.id = _item_id AND b.project_id = _project_id
    AND i.procurement_quote_id IS NULL AND i.source_quote_item_id IS NULL
  FOR UPDATE OF i;

  IF _board_id IS NULL THEN
    RAISE EXCEPTION 'Unlocked specification item not found in this project';
  END IF;

  UPDATE public.client_board_items AS i
  SET product_id = _product_id,
      variant_label = NULLIF(btrim(_finish_label), ''),
      wood_label = NULL,
      fabric_label = NULL
  WHERE i.id = _item_id;

  DELETE FROM public.project_studio_finishes
  WHERE project_id = _project_id AND item_key = _item_id::text;

  RETURN QUERY
  SELECT i.id, i.product_id, i.variant_label
  FROM public.client_board_items AS i
  WHERE i.id = _item_id;
END;
$$;

REVOKE ALL ON FUNCTION public.swap_visualiser_board_item(uuid, uuid, uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.swap_visualiser_board_item(uuid, uuid, uuid, text) TO authenticated, service_role;