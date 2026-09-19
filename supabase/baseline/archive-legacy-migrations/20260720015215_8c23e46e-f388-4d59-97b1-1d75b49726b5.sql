
-- 1) Remove anon SELECT on collectible_overrides; expose only trade-only slugs via RPC
DROP POLICY IF EXISTS "Anon can read only trade_only slugs" ON public.collectible_overrides;
REVOKE SELECT ON public.collectible_overrides FROM anon;

CREATE OR REPLACE FUNCTION public.get_trade_only_collectible_slugs()
RETURNS SETOF text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT slug FROM public.collectible_overrides WHERE trade_only = true;
$$;

GRANT EXECUTE ON FUNCTION public.get_trade_only_collectible_slugs() TO anon, authenticated;

-- 2) Harden accept_studio_invite: block owner-role invites unless inviter still holds owner
CREATE OR REPLACE FUNCTION public.accept_studio_invite(_invite_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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

  -- Defense in depth: for role='owner', re-verify the inviter still holds owner
  -- of the target studio at redemption time. Mirrors the INSERT policy on
  -- studio_invites which only lets owners create owner-role invites.
  IF v_invite.role = 'owner'::public.studio_role THEN
    IF v_invite.invited_by IS NULL
       OR NOT public.has_studio_role(v_invite.invited_by, v_invite.studio_id, 'owner'::public.studio_role) THEN
      RAISE EXCEPTION 'Owner-role invitation is no longer valid' USING ERRCODE = '42501';
    END IF;
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
$function$;
