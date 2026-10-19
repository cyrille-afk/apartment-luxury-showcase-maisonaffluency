CREATE OR REPLACE FUNCTION public.studio_invite_link_status(_invite_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE inv record; v_email text; v_member boolean;
BEGIN
 IF auth.uid() IS NULL THEN RETURN jsonb_build_object('status','unavailable'); END IF;
 SELECT email INTO v_email FROM auth.users WHERE id = auth.uid();
 SELECT i.*, s.name AS studio_name INTO inv FROM public.studio_invites i LEFT JOIN public.studios s ON s.id = i.studio_id
  WHERE i.id = _invite_id AND lower(i.email) = lower(v_email);
 -- Revoked and other-account invitations are indistinguishable to avoid leaking invitations.
 IF NOT FOUND THEN RETURN jsonb_build_object('status','unavailable'); END IF;
 SELECT EXISTS(SELECT 1 FROM public.studio_members m WHERE m.studio_id = inv.studio_id AND m.user_id = auth.uid()) INTO v_member;
 IF inv.accepted_at IS NOT NULL THEN
  RETURN jsonb_build_object('status','accepted','studio_id',inv.studio_id,'studio_name',inv.studio_name,'is_member',v_member,'accepted_at',inv.accepted_at);
 END IF;
 IF inv.expires_at IS NOT NULL AND inv.expires_at < now() THEN
  RETURN jsonb_build_object('status','expired','studio_id',inv.studio_id,'studio_name',inv.studio_name,'expires_at',inv.expires_at);
 END IF;
 RETURN jsonb_build_object('status','pending','studio_id',inv.studio_id,'studio_name',inv.studio_name);
END; $$;
REVOKE ALL ON FUNCTION public.studio_invite_link_status(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.studio_invite_link_status(uuid) TO authenticated;