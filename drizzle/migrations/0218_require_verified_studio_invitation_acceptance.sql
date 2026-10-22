CREATE OR REPLACE FUNCTION public.has_valid_studio_invite(_user_id uuid, _studio_id uuid, _role public.studio_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
 SELECT _user_id = auth.uid() AND EXISTS (
 SELECT 1 FROM public.studio_invites si JOIN auth.users u ON u.id = _user_id
 WHERE si.studio_id = _studio_id AND si.role = _role AND si.accepted_at IS NULL
 AND si.expires_at > now() AND u.email_confirmed_at IS NOT NULL
 AND lower(si.email) = lower(u.email::text)
 AND (si.role <> 'owner'::public.studio_role OR public.has_studio_role(si.invited_by, si.studio_id, 'owner'::public.studio_role))
 );
$$;
REVOKE ALL ON FUNCTION public.has_valid_studio_invite(uuid, uuid, public.studio_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_valid_studio_invite(uuid, uuid, public.studio_role) TO authenticated, service_role;
DO $$
DECLARE definition text;
BEGIN
 SELECT pg_get_functiondef('public.accept_studio_invite(uuid)'::regprocedure) INTO definition;
 definition := replace(definition, 'SELECT email INTO v_user_email FROM auth.users WHERE id = v_user_id;', 'SELECT email INTO v_user_email FROM auth.users WHERE id = v_user_id AND email_confirmed_at IS NOT NULL;');
 definition := replace(definition, 'IF v_invite.expires_at IS NOT NULL AND v_invite.expires_at < now()', 'IF v_invite.expires_at IS NULL OR v_invite.expires_at <= now()');
 IF strpos(definition, 'AND email_confirmed_at IS NOT NULL') = 0 THEN RAISE EXCEPTION 'Confirmation guard could not be applied'; END IF;
 EXECUTE definition;
END $$;
REVOKE ALL ON FUNCTION public.accept_studio_invite(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.accept_studio_invite(uuid) TO authenticated, service_role;
CREATE OR REPLACE FUNCTION public.auto_accept_studio_invites()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
 -- Profile fields are editable and profile creation is not mailbox proof.
 -- All redemption now uses the explicit, row-locking verified acceptance RPC.
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.auto_accept_studio_invites() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.auto_accept_studio_invites() TO service_role;
COMMENT ON FUNCTION public.auto_accept_studio_invites() IS 'DEPRECATED: invitations require explicit verified-email accept_studio_invite redemption.';
DO $$ BEGIN
 IF has_function_privilege('anon', 'public.accept_studio_invite(uuid)', 'EXECUTE') OR has_function_privilege('anon', 'public.has_valid_studio_invite(uuid,uuid,public.studio_role)', 'EXECUTE') THEN RAISE EXCEPTION 'Anonymous invite access remains'; END IF;
 IF NOT has_function_privilege('authenticated', 'public.accept_studio_invite(uuid)', 'EXECUTE') THEN RAISE EXCEPTION 'Authenticated invite acceptance unavailable'; END IF;
END $$;