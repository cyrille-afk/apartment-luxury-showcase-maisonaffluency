ALTER TABLE public.developer_projects ADD COLUMN access_expires_at timestamptz, ADD COLUMN access_revoked_at timestamptz;
CREATE OR REPLACE FUNCTION public.admin_end_viewing_room_access(_project_id uuid, _developer_id uuid, _action text, _expires_at timestamptz DEFAULT NULL) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE d public.developer_projects;
BEGIN
 IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'Administrator access required'; END IF;
 SELECT * INTO d FROM public.developer_projects WHERE id=_developer_id AND project_id=_project_id FOR UPDATE;
 IF d.id IS NULL THEN RAISE EXCEPTION 'Viewing room not found'; END IF;
 IF d.access_revoked_at IS NOT NULL THEN RAISE EXCEPTION 'This code has been revoked'; END IF;
 IF _action='revoke' THEN
  UPDATE public.developer_projects SET access_revoked_at=now() WHERE id=d.id;
 ELSIF _action='expire' THEN
  IF _expires_at IS NULL OR _expires_at<=now() THEN RAISE EXCEPTION 'Choose a future expiry'; END IF;
  IF d.access_expires_at IS NOT NULL AND d.access_expires_at<=now() THEN RAISE EXCEPTION 'This code has expired'; END IF;
  UPDATE public.developer_projects SET access_expires_at=_expires_at WHERE id=d.id;
 ELSE RAISE EXCEPTION 'Invalid access action'; END IF;
END $$;
REVOKE ALL ON FUNCTION public.admin_end_viewing_room_access(uuid,uuid,text,timestamptz) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.admin_end_viewing_room_access(uuid,uuid,text,timestamptz) TO authenticated,service_role;
DO $migration$
DECLARE f record; definition text;
BEGIN
 FOR f IN SELECT p.oid FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname IN ('get_developer_viewing_room','get_viewing_room_package','get_viewing_room_choices','get_viewing_room_personalization','lock_viewing_room_proposal') LOOP
  definition:=pg_get_functiondef(f.oid);
  definition:=regexp_replace(definition,'\mBEGIN\M', E'BEGIN\n IF NOT EXISTS (SELECT 1 FROM public.developer_projects WHERE access_token=_token AND access_revoked_at IS NULL AND (access_expires_at IS NULL OR access_expires_at>now())) THEN RETURN NULL; END IF;', 'i');
  EXECUTE definition;
 END LOOP;
END $migration$;