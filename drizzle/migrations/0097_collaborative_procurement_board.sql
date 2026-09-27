ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS referred_by_studio_id uuid REFERENCES public.studios(id) ON DELETE SET NULL;

CREATE TABLE public.board_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  board_id uuid NOT NULL REFERENCES public.client_boards(id) ON DELETE CASCADE,
  email text NOT NULL,
  role text NOT NULL CHECK (role IN ('client','contractor')),
  token_hash text NOT NULL UNIQUE,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','accepted','revoked')),
  invited_by uuid NOT NULL,
  accepted_user_id uuid,
  expires_at timestamptz NOT NULL DEFAULT now() + interval '30 days',
  last_seen_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX board_invites_board_idx ON public.board_invites(board_id);
GRANT SELECT, UPDATE ON public.board_invites TO authenticated;
GRANT ALL ON public.board_invites TO service_role;
ALTER TABLE public.board_invites ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.board_item_feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  board_id uuid NOT NULL REFERENCES public.client_boards(id) ON DELETE CASCADE,
  item_id uuid NOT NULL REFERENCES public.client_board_items(id) ON DELETE CASCADE,
  invite_id uuid REFERENCES public.board_invites(id) ON DELETE SET NULL,
  user_id uuid,
  reaction text CHECK (reaction IN ('up','down','heart')),
  comment text CHECK (comment IS NULL OR length(comment) <= 1000),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX board_item_feedback_board_idx ON public.board_item_feedback(board_id);
GRANT SELECT ON public.board_item_feedback TO authenticated;
GRANT ALL ON public.board_item_feedback TO service_role;
ALTER TABLE public.board_item_feedback ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.can_manage_board(_board_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.client_boards b
    WHERE b.id = _board_id AND auth.uid() IS NOT NULL
      AND (b.user_id = auth.uid() OR (b.studio_id IS NOT NULL AND public.can_edit_studio(auth.uid(), b.studio_id)))
  )
$$;

CREATE POLICY "Board managers read invites" ON public.board_invites FOR SELECT TO authenticated USING (public.can_manage_board(board_id));
CREATE POLICY "Board managers update invites" ON public.board_invites FOR UPDATE TO authenticated USING (public.can_manage_board(board_id)) WITH CHECK (public.can_manage_board(board_id));
CREATE POLICY "Board managers read feedback" ON public.board_item_feedback FOR SELECT TO authenticated USING (public.can_manage_board(board_id));

CREATE OR REPLACE FUNCTION public.create_board_invite(_board_id uuid, _email text, _role text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions AS $$
DECLARE _token text; _id uuid; _e text := lower(trim(_email));
BEGIN
  IF NOT public.can_manage_board(_board_id) THEN RAISE EXCEPTION 'Not allowed'; END IF;
  IF _e !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' OR length(_e) > 255 THEN RAISE EXCEPTION 'Invalid email'; END IF;
  IF _role NOT IN ('client','contractor') THEN RAISE EXCEPTION 'Invalid role'; END IF;
  _token := encode(extensions.gen_random_bytes(24), 'hex');
  INSERT INTO public.board_invites(board_id, email, role, token_hash, invited_by)
  VALUES (_board_id, _e, _role, encode(extensions.digest(_token, 'sha256'), 'hex'), auth.uid())
  RETURNING id INTO _id;
  UPDATE public.client_boards SET status = 'shared' WHERE id = _board_id AND status = 'draft';
  RETURN jsonb_build_object('id', _id, 'token', _token);
END $$;

CREATE OR REPLACE FUNCTION public._board_invite_by_token(_token text)
RETURNS public.board_invites LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, extensions AS $$
  SELECT i.* FROM public.board_invites i
  WHERE i.token_hash = encode(extensions.digest(coalesce(_token,''), 'sha256'), 'hex')
    AND i.status <> 'revoked' AND i.expires_at > now()
$$;
REVOKE ALL ON FUNCTION public._board_invite_by_token(text) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.get_shared_board(_token text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE inv public.board_invites; b public.client_boards; _items jsonb;
BEGIN
  inv := public._board_invite_by_token(_token);
  IF inv.id IS NULL THEN RETURN NULL; END IF;
  SELECT * INTO b FROM public.client_boards WHERE id = inv.board_id;
  UPDATE public.board_invites SET last_seen_at = now() WHERE id = inv.id;
  SELECT coalesce(jsonb_agg(jsonb_build_object(
      'id', bi.id,
      'product_name', coalesce(tp.product_name, 'Selected piece'),
      'image_url', tp.image_url,
      'msrp_cents', nullif(tp.trade_price_cents, 0),
      'currency', coalesce(tp.currency, 'EUR'),
      'lead_time', coalesce(tp.lead_time,
         CASE WHEN tp.lead_time_weeks_min IS NOT NULL THEN tp.lead_time_weeks_min || '–' || coalesce(tp.lead_time_weeks_max, tp.lead_time_weeks_min) || ' weeks' END),
      'finish', nullif(concat_ws(' · ', bi.variant_label, bi.fabric_label, bi.wood_label), ''),
      'approval_status', bi.approval_status,
      'my_reaction', (SELECT f.reaction FROM public.board_item_feedback f WHERE f.item_id = bi.id AND f.invite_id = inv.id AND f.reaction IS NOT NULL ORDER BY f.created_at DESC LIMIT 1)
    ) ORDER BY bi.sort_order), '[]'::jsonb)
  INTO _items
  FROM public.client_board_items bi LEFT JOIN public.trade_products tp ON tp.id = bi.product_id
  WHERE bi.board_id = b.id;
  RETURN jsonb_build_object(
    'board_title', b.title, 'client_name', b.client_name,
    'studio_name', coalesce(b.studio_name, (SELECT name FROM public.studios WHERE id = b.studio_id), 'Your designer'),
    'studio_logo_url', b.studio_logo_url,
    'role', inv.role, 'invite_email', inv.email,
    'claimed', inv.accepted_user_id IS NOT NULL,
    'items', _items);
END $$;

CREATE OR REPLACE FUNCTION public.submit_board_feedback(_token text, _item_id uuid, _reaction text, _comment text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
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
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.claim_board_invite(_token text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE inv public.board_invites; _studio uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Sign in required'; END IF;
  inv := public._board_invite_by_token(_token);
  IF inv.id IS NULL THEN RAISE EXCEPTION 'Invalid link'; END IF;
  IF inv.accepted_user_id IS NOT NULL AND inv.accepted_user_id <> auth.uid() THEN RAISE EXCEPTION 'Invite already claimed'; END IF;
  UPDATE public.board_invites SET accepted_user_id = auth.uid(), status = 'accepted' WHERE id = inv.id;
  SELECT studio_id INTO _studio FROM public.client_boards WHERE id = inv.board_id;
  IF _studio IS NOT NULL THEN
    UPDATE public.profiles SET referred_by_studio_id = _studio WHERE id = auth.uid() AND referred_by_studio_id IS NULL;
  END IF;
  RETURN jsonb_build_object('role', inv.role);
END $$;

CREATE OR REPLACE FUNCTION public.contractor_add_board_item(_token text, _product_id uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE inv public.board_invites; _id uuid;
BEGIN
  inv := public._board_invite_by_token(_token);
  IF inv.id IS NULL OR inv.role <> 'contractor' OR inv.accepted_user_id IS DISTINCT FROM auth.uid() OR auth.uid() IS NULL THEN RAISE EXCEPTION 'Not allowed'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.trade_products WHERE id = _product_id AND is_active IS NOT FALSE) THEN RAISE EXCEPTION 'Unknown product'; END IF;
  INSERT INTO public.client_board_items(board_id, product_id, sort_order, added_by, saved_via)
  VALUES (inv.board_id, _product_id, coalesce((SELECT max(sort_order)+1 FROM public.client_board_items WHERE board_id = inv.board_id), 0), auth.uid(), 'contractor_invite')
  RETURNING id INTO _id;
  RETURN _id;
END $$;

REVOKE ALL ON FUNCTION public.create_board_invite(uuid,text,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_board_invite(uuid,text,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_shared_board(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.submit_board_feedback(text,uuid,text,text) TO anon, authenticated;
REVOKE ALL ON FUNCTION public.claim_board_invite(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.claim_board_invite(text) TO authenticated;
REVOKE ALL ON FUNCTION public.contractor_add_board_item(text,uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.contractor_add_board_item(text,uuid) TO authenticated;