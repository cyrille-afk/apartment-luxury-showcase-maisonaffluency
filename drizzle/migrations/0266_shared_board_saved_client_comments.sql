DO $migration$
DECLARE definition text;
BEGIN
  SELECT pg_get_functiondef('public.get_shared_board(text)'::regprocedure) INTO definition;
  IF position('''my_comments''' in definition) = 0 THEN
    definition := replace(definition,
      '''approval_status'', bi.approval_status,',
      $addition$'my_comments', (SELECT coalesce(jsonb_agg(jsonb_build_object('id', f.id, 'comment', f.comment, 'created_at', f.created_at) ORDER BY f.created_at, f.id), '[]'::jsonb)
        FROM public.board_item_feedback f JOIN public.board_invites previous ON previous.id = f.invite_id
        WHERE f.item_id = bi.id AND f.board_id = inv.board_id AND previous.board_id = inv.board_id
          AND previous.role = inv.role AND lower(trim(previous.email)) = lower(trim(inv.email))
          AND f.comment IS NOT NULL),
      'approval_status', bi.approval_status,$addition$);
    IF position('''my_comments''' in definition) = 0 THEN RAISE EXCEPTION 'Shared board feedback insertion point missing'; END IF;
  END IF;
  -- The prefix 'Finish request: ' is 16 characters; the value begins at 17.
  definition := replace(definition, 'substring(f.comment from 18)', 'substring(f.comment from 17)');
  EXECUTE definition;
END;
$migration$;