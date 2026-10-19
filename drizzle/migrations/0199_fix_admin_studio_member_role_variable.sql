CREATE OR REPLACE FUNCTION public.admin_manage_studio_member(_studio_id uuid, _member_id uuid, _action text, _expected_role public.studio_role, _role public.studio_role DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE existing_member_role public.studio_role;
BEGIN
  IF auth.uid() IS NULL OR NOT (public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'super_admin'::public.app_role)) THEN
    RAISE EXCEPTION 'Administrator access required' USING ERRCODE = '42501';
  END IF;
  IF _action IS NULL OR _action NOT IN ('change_role', 'remove') THEN
    RAISE EXCEPTION 'Invalid member action' USING ERRCODE = '22023';
  END IF;
  PERFORM 1 FROM public.studios WHERE id = _studio_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Studio not found' USING ERRCODE = 'P0002'; END IF;
  SELECT role INTO existing_member_role FROM public.studio_members WHERE id = _member_id AND studio_id = _studio_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Member not found in this studio' USING ERRCODE = 'P0002'; END IF;
  IF existing_member_role = 'owner' THEN
    RAISE EXCEPTION 'Studio owners cannot be removed or have their role changed' USING ERRCODE = '42501';
  END IF;
  IF existing_member_role IS DISTINCT FROM _expected_role THEN
    RAISE EXCEPTION 'Member role has changed. Refresh the studio and try again' USING ERRCODE = '40001';
  END IF;
  IF _action = 'change_role' THEN
    IF _role IS NULL OR _role NOT IN ('admin', 'editor', 'viewer') THEN
      RAISE EXCEPTION 'Choose admin, editor or viewer' USING ERRCODE = '22023';
    END IF;
    UPDATE public.studio_members SET role = _role WHERE id = _member_id AND studio_id = _studio_id;
  ELSE
    DELETE FROM public.studio_members WHERE id = _member_id AND studio_id = _studio_id;
  END IF;
END;
$$;
REVOKE ALL ON FUNCTION public.admin_manage_studio_member(uuid, uuid, text, public.studio_role, public.studio_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_manage_studio_member(uuid, uuid, text, public.studio_role, public.studio_role) TO authenticated;