CREATE TABLE public.customer_saved_collections (
 user_id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
 favorites jsonb NOT NULL DEFAULT '[]'::jsonb,
 folders jsonb NOT NULL DEFAULT '{}'::jsonb,
 assignments jsonb NOT NULL DEFAULT '{}'::jsonb,
 updated_at timestamptz NOT NULL DEFAULT now(),
 CONSTRAINT customer_saved_shapes CHECK (jsonb_typeof(favorites)='array' AND jsonb_typeof(folders)='object' AND jsonb_typeof(assignments)='object')
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.customer_saved_collections TO authenticated;
GRANT ALL ON public.customer_saved_collections TO service_role;
ALTER TABLE public.customer_saved_collections ENABLE ROW LEVEL SECURITY;
CREATE POLICY customer_saved_owner ON public.customer_saved_collections FOR ALL TO authenticated USING (user_id=(select auth.uid())) WITH CHECK (user_id=(select auth.uid()));
CREATE FUNCTION public.change_customer_saved_collection(_changes jsonb) RETURNS public.customer_saved_collections LANGUAGE plpgsql SECURITY INVOKER SET search_path=public AS $$
DECLARE uid uuid:=auth.uid(); saved public.customer_saved_collections; op jsonb; kind text; key text; folder_key text; val jsonb;
BEGIN
 IF uid IS NULL THEN RAISE EXCEPTION 'Sign in required'; END IF;
 IF jsonb_typeof(_changes)<>'array' OR jsonb_array_length(_changes)>1000 OR octet_length(_changes::text)>262144 THEN RAISE EXCEPTION 'Invalid saved collection changes'; END IF;
 INSERT INTO public.customer_saved_collections(user_id) VALUES(uid) ON CONFLICT(user_id) DO NOTHING;
 SELECT * INTO saved FROM public.customer_saved_collections WHERE user_id=uid FOR UPDATE;
 FOR op IN SELECT value FROM jsonb_array_elements(_changes) LOOP
  kind:=op->>'kind'; key:=op->>'id'; folder_key:=op->>'folderId';
  IF key IS NULL OR length(key)>100 OR key !~ '^[a-zA-Z0-9_-]+$' THEN RAISE EXCEPTION 'Invalid saved identity'; END IF;
  CASE kind
   WHEN 'favorite_add' THEN IF NOT saved.favorites @> jsonb_build_array(key) THEN saved.favorites:=saved.favorites||jsonb_build_array(key); END IF;
   WHEN 'favorite_remove' THEN saved.favorites:=saved.favorites-key; saved.assignments:=saved.assignments-key;
   WHEN 'folder_put' THEN
    IF length(btrim(op->>'name')) NOT BETWEEN 1 AND 60 OR (op->>'createdAt') IS NULL THEN RAISE EXCEPTION 'Invalid folder'; END IF;
    saved.folders:=jsonb_set(saved.folders,ARRAY[key],jsonb_build_object('id',key,'name',btrim(op->>'name'),'createdAt',(op->>'createdAt')::bigint),true);
   WHEN 'folder_remove' THEN
    saved.folders:=saved.folders-key;
    SELECT coalesce(jsonb_object_agg(a.key,a.value-key),'{}'::jsonb) INTO saved.assignments FROM jsonb_each(saved.assignments) a;
   WHEN 'assignment_add' THEN
    IF folder_key IS NULL OR NOT saved.folders ? folder_key THEN RAISE EXCEPTION 'Folder unavailable'; END IF;
    val:=coalesce(saved.assignments->key,'[]'::jsonb);
    IF NOT val @> jsonb_build_array(folder_key) THEN saved.assignments:=jsonb_set(saved.assignments,ARRAY[key],val||jsonb_build_array(folder_key),true); END IF;
    IF NOT saved.favorites @> jsonb_build_array(key) THEN saved.favorites:=saved.favorites||jsonb_build_array(key); END IF;
   WHEN 'assignment_remove' THEN saved.assignments:=jsonb_set(saved.assignments,ARRAY[key],coalesce(saved.assignments->key,'[]'::jsonb)-folder_key,true);
   ELSE RAISE EXCEPTION 'Unsupported saved collection change';
  END CASE;
 END LOOP;
 UPDATE public.customer_saved_collections SET favorites=saved.favorites,folders=saved.folders,assignments=saved.assignments,updated_at=now() WHERE user_id=uid RETURNING * INTO saved;
 RETURN saved;
END;
$$;
REVOKE ALL ON FUNCTION public.change_customer_saved_collection(jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.change_customer_saved_collection(jsonb) TO authenticated,service_role;