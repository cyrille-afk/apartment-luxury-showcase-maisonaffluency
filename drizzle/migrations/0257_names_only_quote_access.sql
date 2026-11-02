ALTER TABLE public.quote_client_shares ADD COLUMN public_slug text;
ALTER TABLE public.quote_client_shares ADD COLUMN recipient_email text;
CREATE INDEX quote_client_shares_public_slug_idx ON public.quote_client_shares(public_slug);
CREATE TABLE public.quote_access_challenges (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), share_id uuid NOT NULL REFERENCES public.quote_client_shares(id) ON DELETE CASCADE, code_hash text NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), expires_at timestamptz NOT NULL DEFAULT now() + interval '10 minutes', attempts integer NOT NULL DEFAULT 0, consumed_at timestamptz);
GRANT ALL ON public.quote_access_challenges TO service_role;
ALTER TABLE public.quote_access_challenges ENABLE ROW LEVEL SECURITY;
CREATE TABLE public.quote_access_sessions (token_hash text PRIMARY KEY, share_id uuid NOT NULL REFERENCES public.quote_client_shares(id) ON DELETE CASCADE, expires_at timestamptz NOT NULL);
GRANT ALL ON public.quote_access_sessions TO service_role;
ALTER TABLE public.quote_access_sessions ENABLE ROW LEVEL SECURITY;
CREATE OR REPLACE FUNCTION public.create_named_quote_share(_quote_id uuid, _snapshot jsonb, _slug text) RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,extensions AS $$
DECLARE q public.trade_quotes; recipient text; chosen text; suffix integer:=1; secret text;
BEGIN
 SELECT * INTO q FROM public.trade_quotes WHERE id=_quote_id AND (user_id=auth.uid() OR public.has_role(auth.uid(),'admin'));
 IF q.id IS NULL THEN RAISE EXCEPTION 'not allowed'; END IF;
 recipient:=lower(trim(q.end_client_billing->>'email'));
 IF coalesce(recipient,'')='' AND q.client_id IS NOT NULL THEN SELECT lower(trim(email)) INTO recipient FROM public.client_contacts WHERE client_id=q.client_id AND coalesce(email,'')<>'' ORDER BY is_primary DESC,created_at LIMIT 1; END IF;
 IF coalesce(recipient,'')='' AND q.source_inquiry_id IS NOT NULL THEN SELECT lower(trim(email)) INTO recipient FROM public.inquiries WHERE id=q.source_inquiry_id; END IF;
 IF coalesce(recipient,'')='' OR recipient !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' THEN RAISE EXCEPTION 'save client email before sharing'; END IF;
 IF _slug !~ '^[a-z]+(-[a-z0-9]+)*$' OR length(_slug)>140 OR jsonb_typeof(_snapshot)<>'object' OR pg_column_size(_snapshot)>200000 THEN RAISE EXCEPTION 'invalid share'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('quote-slug-allocation',0));
 SELECT public_slug INTO chosen FROM public.quote_client_shares WHERE quote_id=_quote_id AND public_slug IS NOT NULL ORDER BY created_at DESC LIMIT 1;
 IF chosen IS NULL THEN
 chosen:=_slug;
 WHILE EXISTS(SELECT 1 FROM public.quote_client_shares WHERE public_slug=chosen AND quote_id<>_quote_id) LOOP
 suffix:=suffix+1;
 chosen:=_slug||'-'|| CASE suffix WHEN 2 THEN 'second' WHEN 3 THEN 'third' WHEN 4 THEN 'fourth' WHEN 5 THEN 'fifth' WHEN 6 THEN 'sixth' WHEN 7 THEN 'seventh' WHEN 8 THEN 'eighth' WHEN 9 THEN 'ninth' WHEN 10 THEN 'tenth' ELSE repeat('next-',suffix-10)||'additional' END ||'-quote';
 END LOOP;
 END IF;
 UPDATE public.quote_client_shares SET revoked_at=now() WHERE quote_id=_quote_id AND public_slug IS NOT NULL AND revoked_at IS NULL;
 secret:=encode(gen_random_bytes(24),'hex');
 INSERT INTO public.quote_client_shares(quote_id,token_hash,snapshot,created_by,public_slug,recipient_email) VALUES(_quote_id,encode(digest(secret,'sha256'),'hex'),_snapshot,auth.uid(),chosen,recipient);
 RETURN chosen;
END $$;
REVOKE ALL ON FUNCTION public.create_named_quote_share(uuid,jsonb,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.create_named_quote_share(uuid,jsonb,text) TO authenticated;
CREATE OR REPLACE FUNCTION public.request_quote_access(_slug text,_email text) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,extensions AS $$
DECLARE s public.quote_client_shares; challenge uuid:=gen_random_uuid(); code text; bytes bytea;
BEGIN
 SELECT * INTO s FROM public.quote_client_shares WHERE public_slug=_slug AND recipient_email=lower(trim(_email)) AND revoked_at IS NULL AND expires_at>now() ORDER BY created_at DESC LIMIT 1 FOR UPDATE;
 IF s.id IS NULL THEN RETURN NULL; END IF;
 IF EXISTS(SELECT 1 FROM public.quote_access_challenges WHERE share_id=s.id AND created_at>now()-interval '45 seconds') THEN RETURN NULL; END IF;
 IF (SELECT count(*) FROM public.quote_access_challenges WHERE share_id=s.id AND created_at>now()-interval '1 hour')>=6 THEN RETURN NULL; END IF;
 bytes:=gen_random_bytes(4); code:=lpad(((get_byte(bytes,0)::bigint*16777216+get_byte(bytes,1)::bigint*65536+get_byte(bytes,2)::bigint*256+get_byte(bytes,3))%1000000)::text,6,'0');
 UPDATE public.quote_access_challenges SET consumed_at=now() WHERE share_id=s.id AND consumed_at IS NULL;
 INSERT INTO public.quote_access_challenges(id,share_id,code_hash) VALUES(challenge,s.id,encode(digest(code||challenge::text,'sha256'),'hex'));
 RETURN jsonb_build_object('id',challenge,'email',s.recipient_email,'code',code);
END $$;
REVOKE ALL ON FUNCTION public.request_quote_access(text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.request_quote_access(text,text) TO service_role;
CREATE OR REPLACE FUNCTION public.verify_quote_access(_slug text,_email text,_code text) RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,extensions AS $$
DECLARE s public.quote_client_shares; c public.quote_access_challenges; token text;
BEGIN
 SELECT * INTO s FROM public.quote_client_shares WHERE public_slug=_slug AND recipient_email=lower(trim(_email)) AND revoked_at IS NULL AND expires_at>now() ORDER BY created_at DESC LIMIT 1 FOR UPDATE;
 IF s.id IS NULL THEN RETURN NULL; END IF;
 SELECT * INTO c FROM public.quote_access_challenges WHERE share_id=s.id AND consumed_at IS NULL ORDER BY created_at DESC LIMIT 1 FOR UPDATE;
 IF c.id IS NULL OR c.expires_at<=now() OR c.attempts>=5 THEN RETURN NULL; END IF;
 UPDATE public.quote_access_challenges SET attempts=attempts+1 WHERE id=c.id;
 IF c.code_hash<>encode(digest(_code||c.id::text,'sha256'),'hex') THEN RETURN NULL; END IF;
 UPDATE public.quote_access_challenges SET consumed_at=now() WHERE id=c.id;
 token:=encode(gen_random_bytes(24),'hex');
 INSERT INTO public.quote_access_sessions(token_hash,share_id,expires_at) VALUES(encode(digest(token,'sha256'),'hex'),s.id,least(s.expires_at,now()+interval '24 hours'));
 RETURN token;
END $$;
REVOKE ALL ON FUNCTION public.verify_quote_access(text,text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.verify_quote_access(text,text,text) TO service_role;
CREATE OR REPLACE FUNCTION public.get_verified_quote(_slug text,_session text) RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,extensions AS $$ SELECT s.snapshot||jsonb_build_object('shared_at',s.created_at,'expires_at',s.expires_at) FROM public.quote_access_sessions a JOIN public.quote_client_shares s ON s.id=a.share_id WHERE a.token_hash=encode(digest(coalesce(_session,''),'sha256'),'hex') AND a.expires_at>now() AND s.public_slug=_slug AND s.revoked_at IS NULL AND s.expires_at>now() $$;
REVOKE ALL ON FUNCTION public.get_verified_quote(text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.get_verified_quote(text,text) TO service_role;