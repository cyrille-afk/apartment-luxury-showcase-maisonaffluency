ALTER TABLE public.board_invites
  ADD COLUMN IF NOT EXISTS access_code_hash text,
  ADD COLUMN IF NOT EXISTS access_code_expires_at timestamptz,
  ADD COLUMN IF NOT EXISTS access_code_attempts int NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS access_code_sent_at timestamptz;

CREATE OR REPLACE FUNCTION public.board_slugify(_t text)
RETURNS text LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT trim(both '-' from regexp_replace(lower(coalesce(_t,'')), '[^a-z0-9]+', '-', 'g'))
$$;

CREATE OR REPLACE FUNCTION public._board_slug(_board_id uuid)
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.board_slugify(coalesce(p.name, b.title))
  FROM public.client_boards b LEFT JOIN public.projects p ON p.id = b.project_id
  WHERE b.id = _board_id
$$;
REVOKE ALL ON FUNCTION public._board_slug(uuid) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.board_share_slug(_board_id uuid)
RETURNS text LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.can_manage_board(_board_id) THEN RAISE EXCEPTION 'Forbidden'; END IF;
  RETURN public._board_slug(_board_id);
END $$;
REVOKE ALL ON FUNCTION public.board_share_slug(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.board_share_slug(uuid) TO authenticated;

-- Service-only: issue a 6-digit access code for an invited email on a slug.
CREATE OR REPLACE FUNCTION public.board_access_request(_slug text, _email text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions AS $$
DECLARE inv public.board_invites; _code text; b public.client_boards; _pname text;
BEGIN
  SELECT i.* INTO inv FROM public.board_invites i
  WHERE lower(i.email) = lower(trim(_email)) AND i.status <> 'revoked' AND i.expires_at > now()
    AND public._board_slug(i.board_id) = public.board_slugify(_slug)
  ORDER BY i.created_at DESC LIMIT 1;
  IF inv.id IS NULL THEN RETURN NULL; END IF;
  IF inv.access_code_sent_at > now() - interval '45 seconds' THEN RAISE EXCEPTION 'Please wait before requesting another code'; END IF;
  _code := lpad((floor(random() * 1000000))::int::text, 6, '0');
  UPDATE public.board_invites SET access_code_hash = encode(digest(_code || inv.id::text, 'sha256'), 'hex'),
    access_code_expires_at = now() + interval '10 minutes', access_code_attempts = 0, access_code_sent_at = now()
  WHERE id = inv.id;
  SELECT * INTO b FROM public.client_boards WHERE id = inv.board_id;
  SELECT name INTO _pname FROM public.projects WHERE id = b.project_id;
  RETURN jsonb_build_object('email', inv.email, 'code', _code,
    'studio_name', coalesce(b.studio_name, (SELECT name FROM public.studios WHERE id = b.studio_id), 'Your designer'),
    'studio_logo_url', coalesce(b.studio_logo_url, (SELECT logo_url FROM public.studios WHERE id = b.studio_id)),
    'hide_maison_branding', b.hide_maison_branding, 'project_name', coalesce(_pname, b.title));
END $$;
REVOKE ALL ON FUNCTION public.board_access_request(text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.board_access_request(text, text) TO service_role;

-- Service-only: verify code, rotate the invite session token and return it.
CREATE OR REPLACE FUNCTION public.board_access_verify(_slug text, _email text, _code text)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions AS $$
DECLARE inv public.board_invites; _token text;
BEGIN
  SELECT i.* INTO inv FROM public.board_invites i
  WHERE lower(i.email) = lower(trim(_email)) AND i.status <> 'revoked' AND i.expires_at > now()
    AND public._board_slug(i.board_id) = public.board_slugify(_slug) AND i.access_code_hash IS NOT NULL
  ORDER BY i.created_at DESC LIMIT 1;
  IF inv.id IS NULL OR inv.access_code_expires_at < now() OR inv.access_code_attempts >= 5 THEN RETURN NULL; END IF;
  IF inv.access_code_hash <> encode(digest(coalesce(_code,'') || inv.id::text, 'sha256'), 'hex') THEN
    UPDATE public.board_invites SET access_code_attempts = access_code_attempts + 1 WHERE id = inv.id;
    RETURN NULL;
  END IF;
  _token := encode(gen_random_bytes(24), 'hex');
  UPDATE public.board_invites SET token_hash = encode(digest(_token, 'sha256'), 'hex'),
    access_code_hash = NULL, access_code_expires_at = NULL, access_code_attempts = 0,
    status = CASE WHEN status = 'pending' THEN 'accepted' ELSE status END
  WHERE id = inv.id;
  RETURN _token;
END $$;
REVOKE ALL ON FUNCTION public.board_access_verify(text, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.board_access_verify(text, text, text) TO service_role;

-- Notify the host designer of every client action.
CREATE OR REPLACE FUNCTION public.notify_board_feedback()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE b public.client_boards; _who text; _pname text; _title text;
BEGIN
  SELECT * INTO b FROM public.client_boards WHERE id = NEW.board_id;
  IF b.user_id IS NULL OR b.user_id = NEW.user_id THEN RETURN NEW; END IF;
  SELECT email INTO _who FROM public.board_invites WHERE id = NEW.invite_id;
  SELECT coalesce(tp.product_name, 'a piece') INTO _pname FROM public.client_board_items bi LEFT JOIN public.trade_products tp ON tp.id = bi.product_id WHERE bi.id = NEW.item_id;
  _title := CASE NEW.reaction WHEN 'heart' THEN 'Client approved ' || _pname
    WHEN 'up' THEN 'Client liked ' || _pname WHEN 'down' THEN 'Client declined ' || _pname
    ELSE CASE WHEN NEW.comment LIKE 'Finish request: %' THEN 'Finish update proposed for ' || _pname ELSE 'New comment on ' || _pname END END;
  INSERT INTO public.notifications(user_id, type, title, message, link, metadata)
  VALUES (b.user_id, 'board_feedback', _title, coalesce(NEW.comment, coalesce(_who, 'Your client') || ' — ' || b.title),
    '/trade/boards/' || b.id, jsonb_build_object('board_id', b.id, 'item_id', NEW.item_id, 'reaction', NEW.reaction));
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_notify_board_feedback ON public.board_item_feedback;
CREATE TRIGGER trg_notify_board_feedback AFTER INSERT ON public.board_item_feedback
FOR EACH ROW EXECUTE FUNCTION public.notify_board_feedback();

-- Guests can send an "approve" with a finish-request note in one call.
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
  IF _reaction = 'heart' THEN UPDATE public.client_board_items SET approval_status = 'approved', updated_at = now() WHERE id = _item_id;
  ELSIF _reaction = 'down' THEN UPDATE public.client_board_items SET approval_status = 'rejected', updated_at = now() WHERE id = _item_id AND approval_status <> 'approved';
  ELSIF _reaction IS NULL AND _comment LIKE 'Finish request: %' THEN UPDATE public.client_board_items SET approval_status = 'pending', updated_at = now() WHERE id = _item_id AND approval_status <> 'approved';
  END IF;
END $function$;