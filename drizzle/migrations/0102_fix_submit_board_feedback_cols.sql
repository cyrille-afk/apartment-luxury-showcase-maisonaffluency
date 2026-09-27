CREATE OR REPLACE FUNCTION public.submit_board_feedback(_token text, _item_id uuid, _reaction text, _comment text)
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE inv public.board_invites;
BEGIN
  inv := public._board_invite_by_token(_token);
  IF inv.id IS NULL THEN RAISE EXCEPTION 'Invalid link'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.client_board_items WHERE id = _item_id AND board_id = inv.board_id) THEN RAISE EXCEPTION 'Invalid item'; END IF;
  IF _reaction IS NOT NULL AND _reaction NOT IN ('up','down','heart') THEN RAISE EXCEPTION 'Invalid reaction'; END IF;
  IF _reaction IS NULL AND coalesce(trim(_comment),'') = '' THEN RAISE EXCEPTION 'Empty feedback'; END IF;
  IF (SELECT count(*) FROM public.board_item_feedback WHERE invite_id = inv.id AND created_at > now() - interval '1 hour') > 200 THEN RAISE EXCEPTION 'Too many requests'; END IF;
  INSERT INTO public.board_item_feedback(board_id, item_id, invite_id, user_id, reaction, comment)
  VALUES (inv.board_id, _item_id, inv.id, auth.uid(), _reaction, nullif(left(trim(coalesce(_comment,'')), 1000), ''));
  IF _reaction = 'heart' THEN UPDATE public.client_board_items SET approval_status = 'approved' WHERE id = _item_id;
  ELSIF _reaction = 'down' THEN UPDATE public.client_board_items SET approval_status = 'rejected' WHERE id = _item_id AND approval_status <> 'approved';
  ELSIF _reaction IS NULL AND _comment LIKE 'Finish request: %' THEN UPDATE public.client_board_items SET approval_status = 'pending' WHERE id = _item_id AND approval_status <> 'approved';
  END IF;
END $function$;