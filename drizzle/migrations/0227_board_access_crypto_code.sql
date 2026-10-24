CREATE OR REPLACE FUNCTION public.board_access_request(_slug text, _email text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
DECLARE inv public.board_invites; _code text; b public.client_boards; _pname text;
BEGIN
  SELECT i.* INTO inv FROM public.board_invites i
  WHERE lower(i.email) = lower(trim(_email)) AND i.status <> 'revoked' AND i.expires_at > now()
    AND public._board_slug(i.board_id) = public._norm_board_path(_slug)
  ORDER BY i.created_at DESC LIMIT 1;
  IF inv.id IS NULL THEN RETURN NULL; END IF;
  IF inv.access_code_sent_at > now() - interval '45 seconds' THEN RAISE EXCEPTION 'Please wait before requesting another code'; END IF;
  _code := lpad(((('x' || encode(extensions.gen_random_bytes(4), 'hex'))::bit(32)::bigint) % 1000000)::text, 6, '0');
  UPDATE public.board_invites SET access_code_hash = encode(digest(_code || inv.id::text, 'sha256'), 'hex'),
    access_code_expires_at = now() + interval '10 minutes', access_code_attempts = 0, access_code_sent_at = now()
  WHERE id = inv.id;
  SELECT * INTO b FROM public.client_boards WHERE id = inv.board_id;
  SELECT name INTO _pname FROM public.projects WHERE id = b.project_id;
  RETURN jsonb_build_object('email', inv.email, 'code', _code,
    'studio_name', coalesce(b.studio_name, (SELECT name FROM public.studios WHERE id = b.studio_id), 'Your designer'),
    'studio_logo_url', coalesce(b.studio_logo_url, (SELECT logo_url FROM public.studios WHERE id = b.studio_id)),
    'hide_maison_branding', b.hide_maison_branding, 'project_name', coalesce(_pname, b.title));
END $function$;