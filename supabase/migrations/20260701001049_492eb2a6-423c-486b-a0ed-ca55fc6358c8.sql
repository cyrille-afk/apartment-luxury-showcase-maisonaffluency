
CREATE OR REPLACE FUNCTION public.accept_studio_invite(_invite_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_user_email text;
  v_invite public.studio_invites%ROWTYPE;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '42501';
  END IF;

  SELECT email INTO v_user_email FROM auth.users WHERE id = v_user_id;
  IF v_user_email IS NULL THEN
    RAISE EXCEPTION 'User email not found' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_invite FROM public.studio_invites WHERE id = _invite_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invitation not found' USING ERRCODE = 'P0002';
  END IF;

  IF lower(v_invite.email) <> lower(v_user_email) THEN
    RAISE EXCEPTION 'Invitation is addressed to a different email' USING ERRCODE = '42501';
  END IF;

  IF v_invite.accepted_at IS NOT NULL THEN
    RAISE EXCEPTION 'Invitation already accepted' USING ERRCODE = '22023';
  END IF;

  IF v_invite.expires_at IS NOT NULL AND v_invite.expires_at < now() THEN
    RAISE EXCEPTION 'Invitation has expired' USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.studio_members (studio_id, user_id, role)
  VALUES (v_invite.studio_id, v_user_id, v_invite.role)
  ON CONFLICT (studio_id, user_id) DO UPDATE SET role = EXCLUDED.role;

  UPDATE public.studio_invites
     SET accepted_at = now(), accepted_by = v_user_id
   WHERE id = _invite_id;

  RETURN jsonb_build_object(
    'studio_id', v_invite.studio_id,
    'role', v_invite.role
  );
END;
$$;

REVOKE ALL ON FUNCTION public.accept_studio_invite(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.accept_studio_invite(uuid) TO authenticated;
