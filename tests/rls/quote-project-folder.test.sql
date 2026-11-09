-- Transactional regression: no customer selections or invitations are retained.
BEGIN;
SELECT set_config('request.jwt.claim.sub', '3106edd7-2854-4b59-a6b3-88a7fa8a5532', true);
DO $$
DECLARE
  _board uuid := gen_random_uuid();
  _quote uuid := gen_random_uuid();
  _first uuid := gen_random_uuid();
  _second uuid := gen_random_uuid();
  _third uuid := gen_random_uuid();
  _project uuid := '6ecaae1a-ac52-40e6-aea6-02eb38256823';
  _count integer;
  _failed boolean := false;
BEGIN
  INSERT INTO public.client_boards(id,user_id,title,project_id,studio_id)
  VALUES(_board,auth.uid(),'Quote folder regression',_project,'8f16a389-f13c-487a-83a2-01b81639e7dd');
  INSERT INTO public.trade_quotes(id,user_id,status,currency) VALUES(_quote,auth.uid(),'draft','EUR');
  INSERT INTO public.trade_quote_items(id,quote_id,product_id,quantity,variant_label)
  VALUES(_first,_quote,'d6094740-c916-4c7f-9f76-08883bc0c066',1,'Wood Finish: Bleached Oak · Metal Finish: Patinated Bronze — Open Pore · Stone Finish: Brown Travertine Sandblasted — Open Pore'),
        (_second,_quote,'9489ea91-8d42-4429-b356-45acf36e5a42',1,'Upholstery: Safire-2 0007 · Frame Finish: Black Pepper Oak');
  PERFORM public.link_quote_project_folder(_quote,_project,_board);
  SELECT count(*) INTO _count FROM public.client_board_items WHERE board_id=_board;
  IF _count <> 2 THEN RAISE EXCEPTION 'Expected two quote products, got %',_count; END IF;
  IF NOT EXISTS(SELECT 1 FROM public.client_board_items WHERE board_id=_board AND source_quote_item_id=_second AND variant_label='Upholstery: Safire-2 0007 · Frame Finish: Black Pepper Oak') THEN RAISE EXCEPTION 'Exact chair finish selection missing'; END IF;
  PERFORM public.link_quote_project_folder(_quote,_project,_board);
  SELECT count(*) INTO _count FROM public.client_board_items WHERE board_id=_board;
  IF _count <> 2 THEN RAISE EXCEPTION 'Retry duplicated quote products'; END IF;
  INSERT INTO public.trade_quote_items(id,quote_id,product_id,quantity,variant_label)
  VALUES(_third,_quote,'d6094740-c916-4c7f-9f76-08883bc0c066',1,'Wood Finish: Black Oak');
  SELECT count(*) INTO _count FROM public.client_board_items WHERE board_id=_board;
  IF _count <> 3 THEN RAISE EXCEPTION 'Later quote addition did not sync'; END IF;
  IF NOT EXISTS(SELECT 1 FROM public.client_board_items WHERE board_id=_board AND source_quote_item_id=_first AND variant_label LIKE 'Wood Finish: Bleached Oak%') THEN RAISE EXCEPTION 'Later addition replaced original configuration'; END IF;
  PERFORM set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000001',true);
  BEGIN
    PERFORM public.link_quote_project_folder(_quote,_project,_board);
  EXCEPTION WHEN OTHERS THEN _failed := true;
  END;
  IF NOT _failed THEN RAISE EXCEPTION 'Unrelated account linked private quote'; END IF;
END $$;
ROLLBACK;