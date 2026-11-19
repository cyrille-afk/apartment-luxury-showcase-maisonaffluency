CREATE OR REPLACE FUNCTION public.generate_viewing_room_short_code() RETURNS text LANGUAGE plpgsql VOLATILE SET search_path=public AS $$
DECLARE alphabet text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; bytes bytea; result text; i integer;
BEGIN
 bytes := extensions.gen_random_bytes(7); result := '';
 FOR i IN 0..6 LOOP result := result || substr(alphabet, (get_byte(bytes,i) % 32)+1,1); END LOOP;
 RETURN substr(result,1,3)||'-'||substr(result,4,4);
END; $$;
REVOKE ALL ON FUNCTION public.generate_viewing_room_short_code() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.generate_viewing_room_short_code() TO authenticated,service_role;
ALTER TABLE public.developer_projects ADD COLUMN short_code text DEFAULT public.generate_viewing_room_short_code();
UPDATE public.developer_projects SET short_code=public.generate_viewing_room_short_code() WHERE short_code IS NULL;
CREATE UNIQUE INDEX developer_projects_short_code_unique ON public.developer_projects(short_code);
ALTER TABLE public.developer_projects ADD CONSTRAINT developer_projects_short_code_format CHECK (short_code ~ '^[A-Z0-9]{3}-[A-Z0-9]{4}$');
CREATE OR REPLACE FUNCTION public.ensure_viewing_room_short_code() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF TG_OP='UPDATE' AND OLD.short_code IS NOT NULL AND NEW.access_token=OLD.access_token THEN NEW.short_code:=OLD.short_code; RETURN NEW; END IF;
 LOOP
  NEW.short_code := public.generate_viewing_room_short_code();
  EXIT WHEN NOT EXISTS(SELECT 1 FROM public.developer_projects WHERE short_code=NEW.short_code);
 END LOOP;
 RETURN NEW;
END; $$;
REVOKE ALL ON FUNCTION public.ensure_viewing_room_short_code() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER developer_projects_short_code BEFORE INSERT OR UPDATE OF short_code,access_token ON public.developer_projects FOR EACH ROW EXECUTE FUNCTION public.ensure_viewing_room_short_code();
CREATE OR REPLACE FUNCTION public.resolve_viewing_room_short_code(_code text,_attempt_key text,_allow_ended boolean DEFAULT false) RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE permitted boolean; credential text;
BEGIN
 IF _code IS NULL OR upper(trim(_code)) !~ '^[A-Z0-9]{3}-[A-Z0-9]{4}$' OR _attempt_key IS NULL OR length(_attempt_key)<>64 THEN RETURN NULL; END IF;
 SELECT allowed INTO permitted FROM public.concierge_check_rate_limit('viewing-room-short:'||_attempt_key,20,900);
 IF NOT permitted THEN RETURN NULL; END IF;
 SELECT access_token INTO credential FROM public.developer_projects WHERE short_code=upper(trim(_code)) AND (_allow_ended OR (access_revoked_at IS NULL AND (access_expires_at IS NULL OR access_expires_at>now())));
 RETURN credential;
END; $$;
REVOKE ALL ON FUNCTION public.resolve_viewing_room_short_code(text,text,boolean) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.resolve_viewing_room_short_code(text,text,boolean) TO service_role;