CREATE TABLE public.quote_client_shares (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_id uuid NOT NULL REFERENCES public.trade_quotes(id) ON DELETE CASCADE,
  token_hash text NOT NULL UNIQUE,
  snapshot jsonb NOT NULL,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT now() + interval '30 days',
  revoked_at timestamptz
);
GRANT SELECT ON public.quote_client_shares TO authenticated;
GRANT ALL ON public.quote_client_shares TO service_role;
ALTER TABLE public.quote_client_shares ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owners view their quote shares" ON public.quote_client_shares FOR SELECT TO authenticated
  USING (created_by = auth.uid() OR public.has_role(auth.uid(),'admin'));

CREATE OR REPLACE FUNCTION public.create_quote_client_share(_quote_id uuid, _snapshot jsonb)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions AS $$
DECLARE _token text;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  IF NOT EXISTS (SELECT 1 FROM trade_quotes q WHERE q.id=_quote_id AND (q.user_id=auth.uid() OR public.has_role(auth.uid(),'admin'))) THEN
    RAISE EXCEPTION 'not allowed';
  END IF;
  IF jsonb_typeof(_snapshot) <> 'object' OR pg_column_size(_snapshot) > 200000 THEN RAISE EXCEPTION 'invalid snapshot'; END IF;
  _token := encode(gen_random_bytes(24),'hex');
  INSERT INTO quote_client_shares(quote_id, token_hash, snapshot, created_by)
  VALUES (_quote_id, encode(digest(_token,'sha256'),'hex'), _snapshot, auth.uid());
  RETURN _token;
END $$;

CREATE OR REPLACE FUNCTION public.revoke_quote_client_shares(_quote_id uuid)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE n integer;
BEGIN
  UPDATE quote_client_shares SET revoked_at=now()
  WHERE quote_id=_quote_id AND revoked_at IS NULL AND (created_by=auth.uid() OR public.has_role(auth.uid(),'admin'));
  GET DIAGNOSTICS n = ROW_COUNT; RETURN n;
END $$;

CREATE OR REPLACE FUNCTION public.get_shared_quote(_token text)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, extensions AS $$
  SELECT s.snapshot || jsonb_build_object('shared_at', s.created_at, 'expires_at', s.expires_at)
  FROM quote_client_shares s
  WHERE s.token_hash = encode(digest(coalesce(_token,''),'sha256'),'hex')
    AND s.revoked_at IS NULL AND s.expires_at > now()
$$;

REVOKE ALL ON FUNCTION public.create_quote_client_share(uuid,jsonb) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.revoke_quote_client_shares(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_quote_client_share(uuid,jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.revoke_quote_client_shares(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_shared_quote(text) TO anon, authenticated;