-- Regression: an OTP session opens ONLY the exact project/board it was issued for,
-- even when one guest has active invites on several boards of the same project.
-- Self-cleaning; raises an exception on any failure. Run as a privileged role.
DO $$
DECLARE
  a public.client_boards; b public.client_boards;
  em text := 'qa-otp-' || substr(md5(random()::text), 1, 8) || '@example.com';
  ia uuid; ib uuid; sa text; sb text; ta text; tb text; r jsonb; inv public.board_invites;
BEGIN
  SELECT x.* INTO a FROM public.client_boards x
  WHERE x.project_id IN (SELECT project_id FROM public.client_boards WHERE project_id IS NOT NULL GROUP BY 1 HAVING count(*) >= 2)
  ORDER BY x.project_id, x.id LIMIT 1;
  SELECT x.* INTO b FROM public.client_boards x WHERE x.project_id = a.project_id AND x.id <> a.id LIMIT 1;
  IF b.id IS NULL THEN RAISE EXCEPTION 'FAIL: need a project with two boards'; END IF;

  -- B's invite is newer (old bug routed to the most recent invite).
  INSERT INTO public.board_invites(board_id,email,role,invited_by,token_hash,status,expires_at,created_at)
  VALUES (a.id, em, 'client', a.user_id, md5(random()::text)||md5(random()::text), 'pending', now()+interval '1 day', now()-interval '1 hour')
  RETURNING id INTO ia;
  INSERT INTO public.board_invites(board_id,email,role,invited_by,token_hash,status,expires_at,created_at)
  VALUES (b.id, em, 'client', b.user_id, md5(random()::text)||md5(random()::text), 'pending', now()+interval '1 day', now())
  RETURNING id INTO ib;

  BEGIN
    sa := public._board_slug(a.id); sb := public._board_slug(b.id);
    IF sa = sb THEN RAISE EXCEPTION 'FAIL: boards share slug %', sa; END IF;

    -- Requesting a code on A's path must target A's invite, not the newer B invite.
    r := public.board_access_request(sa, em);
    IF r IS NULL THEN RAISE EXCEPTION 'FAIL: request on A returned null'; END IF;
    SELECT * INTO inv FROM public.board_invites WHERE id = ib;
    IF inv.access_code_hash IS NOT NULL THEN RAISE EXCEPTION 'FAIL: code issued on B invite for A path'; END IF;

    -- Wrong board path with A's code is rejected.
    IF public.board_access_verify(sb, em, r->>'code') IS NOT NULL THEN RAISE EXCEPTION 'FAIL: A code opened B'; END IF;

    ta := public.board_access_verify(sa, em, r->>'code');
    IF ta IS NULL THEN RAISE EXCEPTION 'FAIL: correct code on A rejected'; END IF;
    IF (public._board_invite_by_token(ta)).board_id <> a.id THEN RAISE EXCEPTION 'FAIL: A session resolves to wrong board'; END IF;

    -- Replay rejected; unknown board path rejected.
    IF public.board_access_verify(sa, em, r->>'code') IS NOT NULL THEN RAISE EXCEPTION 'FAIL: code replay accepted'; END IF;
    IF public.board_access_request(split_part(sa,'/',1) || '/does-not-exist', em) IS NOT NULL THEN RAISE EXCEPTION 'FAIL: unknown path accepted'; END IF;

    -- B independent: its own code opens B only; A session still valid.
    r := public.board_access_request(sb, em);
    tb := public.board_access_verify(sb, em, r->>'code');
    IF tb IS NULL OR (public._board_invite_by_token(tb)).board_id <> b.id THEN RAISE EXCEPTION 'FAIL: B session wrong'; END IF;
    IF (public._board_invite_by_token(ta)).board_id <> a.id THEN RAISE EXCEPTION 'FAIL: B verify broke A session'; END IF;
  EXCEPTION WHEN OTHERS THEN
    DELETE FROM public.board_guest_sessions WHERE invite_id IN (ia, ib);
    DELETE FROM public.board_invites WHERE id IN (ia, ib);
    RAISE;
  END;

  DELETE FROM public.board_guest_sessions WHERE invite_id IN (ia, ib);
  DELETE FROM public.board_invites WHERE id IN (ia, ib);
  RAISE NOTICE 'PASS: board OTP scope regression';
END $$;
