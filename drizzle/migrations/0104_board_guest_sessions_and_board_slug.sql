CREATE TABLE IF NOT EXISTS public.board_guest_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invite_id uuid NOT NULL REFERENCES public.board_invites(id) ON DELETE CASCADE,
  token_hash text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT now() + interval '30 days'
);
GRANT ALL ON public.board_guest_sessions TO service_role;
ALTER TABLE public.board_guest_sessions ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS board_guest_sessions_invite_idx ON public.board_guest_sessions(invite_id);

-- Slug is now "<project-slug>/<board-slug>" so boards in one project never collide.
CREATE OR REPLACE FUNCTION public._board_slug(_board_id uuid)
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT CASE WHEN p.name IS NOT NULL
    THEN public.board_slugify(p.name) || '/' || public.board_slugify(b.title)
    ELSE 'board/' || public.board_slugify(b.title) END
  FROM public.client_boards b LEFT JOIN public.projects p ON p.id = b.project_id
  WHERE b.id = _board_id
$$;
CREATE OR REPLACE FUNCTION public._norm_board_path(_p text)
RETURNS text LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT array_to_string(ARRAY(SELECT public.board_slugify(x) FROM unnest(string_to_array(coalesce(_p,''), '/')) x WHERE public.board_slugify(x) <> ''), '/')
$$;

-- Accept either the invite's own token or any isolated guest session token.
CREATE OR REPLACE FUNCTION public._board_invite_by_token(_token text)
RETURNS board_invites LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public', 'extensions' AS $function$
  SELECT i.* FROM public.board_invites i
  WHERE i.status <> 'revoked' AND i.expires_at > now()
    AND (i.token_hash = encode(extensions.digest(coalesce(_token,''), 'sha256'), 'hex')
      OR EXISTS (SELECT 1 FROM public.board_guest_sessions s WHERE s.invite_id = i.id AND s.expires_at > now()
                 AND s.token_hash = encode(extensions.digest(coalesce(_token,''), 'sha256'), 'hex')))
  LIMIT 1
$function$;

CREATE OR REPLACE FUNCTION public.board_access_request(_slug text, _email text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions AS $$
DECLARE inv public.board_invites; _code text; b public.client_boards; _pname text;
BEGIN
  SELECT i.* INTO inv FROM public.board_invites i
  WHERE lower(i.email) = lower(trim(_email)) AND i.status <> 'revoked' AND i.expires_at > now()
    AND public._board_slug(i.board_id) = public._norm_board_path(_slug)
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

-- Verification issues a NEW isolated session; the invite token and other guests are untouched.
CREATE OR REPLACE FUNCTION public.board_access_verify(_slug text, _email text, _code text)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions AS $$
DECLARE inv public.board_invites; _token text;
BEGIN
  SELECT i.* INTO inv FROM public.board_invites i
  WHERE lower(i.email) = lower(trim(_email)) AND i.status <> 'revoked' AND i.expires_at > now()
    AND public._board_slug(i.board_id) = public._norm_board_path(_slug) AND i.access_code_hash IS NOT NULL
  ORDER BY i.created_at DESC LIMIT 1;
  IF inv.id IS NULL OR inv.access_code_expires_at < now() OR inv.access_code_attempts >= 5 THEN RETURN NULL; END IF;
  IF inv.access_code_hash <> encode(digest(coalesce(_code,'') || inv.id::text, 'sha256'), 'hex') THEN
    UPDATE public.board_invites SET access_code_attempts = access_code_attempts + 1 WHERE id = inv.id;
    RETURN NULL;
  END IF;
  _token := encode(gen_random_bytes(24), 'hex');
  INSERT INTO public.board_guest_sessions(invite_id, token_hash, expires_at)
  VALUES (inv.id, encode(digest(_token, 'sha256'), 'hex'), least(inv.expires_at, now() + interval '30 days'));
  UPDATE public.board_invites SET access_code_hash = NULL, access_code_expires_at = NULL, access_code_attempts = 0,
    status = CASE WHEN status = 'pending' THEN 'accepted' ELSE status END
  WHERE id = inv.id;
  RETURN _token;
END $$;