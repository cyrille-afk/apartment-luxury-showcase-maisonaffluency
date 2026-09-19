
-- 1) Hide studio_invites.token from authenticated (only service_role should read it)
REVOKE SELECT (token) ON public.studio_invites FROM authenticated;
REVOKE SELECT (token) ON public.studio_invites FROM anon;

-- 2) Hide client_boards.share_token from authenticated; expose via SECURITY DEFINER RPC to owner only
REVOKE SELECT (share_token) ON public.client_boards FROM authenticated;
REVOKE SELECT (share_token) ON public.client_boards FROM anon;

CREATE OR REPLACE FUNCTION public.get_my_board_share_token(_board_id uuid)
RETURNS text
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _token text;
  _owner uuid;
BEGIN
  SELECT user_id, share_token INTO _owner, _token
  FROM public.client_boards
  WHERE id = _board_id;
  IF _owner IS NULL THEN RETURN NULL; END IF;
  IF _owner = auth.uid() OR public.has_role(auth.uid(), 'admin'::app_role) THEN
    RETURN _token;
  END IF;
  RETURN NULL;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_my_board_share_token(uuid) TO authenticated;
