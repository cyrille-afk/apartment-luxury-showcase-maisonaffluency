ALTER TABLE public.abandoned_carts ADD COLUMN buyer_profile text;
CREATE TABLE public.private_client_challenges (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 email text NOT NULL,
 code_hash text NOT NULL,
 ip_hash text NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(),
 expires_at timestamptz NOT NULL DEFAULT now() + interval '10 minutes',
 attempts integer NOT NULL DEFAULT 0,
 consumed_at timestamptz
);
GRANT ALL ON public.private_client_challenges TO service_role;
ALTER TABLE public.private_client_challenges ENABLE ROW LEVEL SECURITY;
CREATE POLICY service_only ON public.private_client_challenges FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE INDEX private_client_challenges_email_time ON public.private_client_challenges(email, created_at);
CREATE INDEX private_client_challenges_ip_time ON public.private_client_challenges(ip_hash, created_at);
CREATE OR REPLACE FUNCTION public.private_client_code_request(_email text, _ip_hash text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions AS $$
DECLARE _id uuid := gen_random_uuid(); _code text; _bytes bytea;
BEGIN
 IF _email IS NULL OR length(_email) > 255 OR _email <> lower(trim(_email)) OR _email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' OR _ip_hash IS NULL THEN RAISE EXCEPTION 'Invalid request'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('recognition-ip:' || _ip_hash,0));
 PERFORM pg_advisory_xact_lock(hashtextextended('recognition-email:' || _email,0));
 IF EXISTS (SELECT 1 FROM private_client_challenges WHERE email = _email AND created_at > now() - interval '45 seconds')
 OR (SELECT count(*) FROM private_client_challenges WHERE email = _email AND created_at > now() - interval '1 hour') >= 5
 OR (SELECT count(*) FROM private_client_challenges WHERE ip_hash = _ip_hash AND created_at > now() - interval '1 hour') >= 20 THEN RETURN NULL; END IF;
 _bytes := gen_random_bytes(4);
 _code := lpad(((get_byte(_bytes,0)::bigint * 16777216 + get_byte(_bytes,1)::bigint * 65536 + get_byte(_bytes,2)::bigint * 256 + get_byte(_bytes,3)) % 1000000)::text,6,'0');
 UPDATE private_client_challenges SET consumed_at = now() WHERE email = _email AND consumed_at IS NULL;
 INSERT INTO private_client_challenges(id,email,code_hash,ip_hash) VALUES (_id,_email,encode(digest(_code || _id::text,'sha256'),'hex'),_ip_hash);
 DELETE FROM private_client_challenges WHERE expires_at < now() - interval '1 day';
 RETURN jsonb_build_object('id',_id,'code',_code);
END $$;
REVOKE ALL ON FUNCTION public.private_client_code_request(text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.private_client_code_request(text,text) TO service_role;
CREATE OR REPLACE FUNCTION public.private_client_code_verify(_id uuid, _email text, _code text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions AS $$
DECLARE c public.private_client_challenges;
BEGIN
 SELECT * INTO c FROM private_client_challenges WHERE id = _id AND email = lower(trim(_email)) FOR UPDATE;
 IF c.id IS NULL OR c.consumed_at IS NOT NULL OR c.expires_at <= now() OR c.attempts >= 5 THEN RETURN false; END IF;
 UPDATE private_client_challenges SET attempts = attempts + 1 WHERE id = c.id;
 IF c.code_hash <> encode(digest(coalesce(_code,'') || c.id::text,'sha256'),'hex') THEN RETURN false; END IF;
 UPDATE private_client_challenges SET consumed_at = now() WHERE id = c.id;
 RETURN true;
END $$;
REVOKE ALL ON FUNCTION public.private_client_code_verify(uuid,text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.private_client_code_verify(uuid,text,text) TO service_role;
CREATE OR REPLACE FUNCTION public.private_client_has_activity(_email text, _exclude_session text DEFAULT NULL)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
 SELECT EXISTS (SELECT 1 FROM public.abandoned_carts WHERE email = lower(trim(_email)) AND buyer_profile = 'private' AND item_count > 0 AND status IN ('active','ordered') AND (_exclude_session IS NULL OR session_id <> _exclude_session))
 OR EXISTS (SELECT 1 FROM public.shop_orders WHERE lower(trim(email)) = lower(trim(_email)) AND buyer_type = 'private' AND status NOT IN ('cancelled','refunded','failed') AND (paid_at IS NOT NULL OR status IN ('paid','completed','fulfilled','delivered')));
$$;
REVOKE ALL ON FUNCTION public.private_client_has_activity(text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.private_client_has_activity(text,text) TO service_role;