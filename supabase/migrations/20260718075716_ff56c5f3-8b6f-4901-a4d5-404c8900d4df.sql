-- 1. Extend app_role enum
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'affluency_member';

-- 2. Invite codes
CREATE TABLE public.portal_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  code_type text NOT NULL DEFAULT 'single_use' CHECK (code_type IN ('single_use','campaign')),
  max_uses integer NOT NULL DEFAULT 1 CHECK (max_uses >= 1),
  uses_count integer NOT NULL DEFAULT 0,
  campaign_name text,
  invited_name text,
  invited_company text,
  notes text,
  expires_at timestamptz,
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.portal_invites TO authenticated;
GRANT ALL ON public.portal_invites TO service_role;

ALTER TABLE public.portal_invites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.portal_invites FORCE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage portal invites"
ON public.portal_invites FOR ALL TO authenticated
USING (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'super_admin'))
WITH CHECK (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'super_admin'));

-- 3. Portal sessions (token-based access, no auth account required)
CREATE TABLE public.portal_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token uuid NOT NULL UNIQUE DEFAULT gen_random_uuid(),
  invite_id uuid NOT NULL REFERENCES public.portal_invites(id) ON DELETE CASCADE,
  corporate_id text NOT NULL,
  ip_address inet,
  user_agent text,
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.portal_sessions TO authenticated;
GRANT ALL ON public.portal_sessions TO service_role;

ALTER TABLE public.portal_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.portal_sessions FORCE ROW LEVEL SECURITY;

CREATE POLICY "Admins view portal sessions"
ON public.portal_sessions FOR SELECT TO authenticated
USING (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'super_admin'));

-- 4. Redemption audit log
CREATE TABLE public.portal_redemptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invite_id uuid NOT NULL REFERENCES public.portal_invites(id) ON DELETE CASCADE,
  session_id uuid REFERENCES public.portal_sessions(id) ON DELETE SET NULL,
  corporate_id text NOT NULL,
  ip_address inet,
  user_agent text,
  redeemed_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.portal_redemptions TO authenticated;
GRANT ALL ON public.portal_redemptions TO service_role;

ALTER TABLE public.portal_redemptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.portal_redemptions FORCE ROW LEVEL SECURITY;

CREATE POLICY "Admins view portal redemptions"
ON public.portal_redemptions FOR SELECT TO authenticated
USING (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'super_admin'));

-- 5. updated_at trigger
CREATE TRIGGER trg_portal_invites_updated
BEFORE UPDATE ON public.portal_invites
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 6. Redeem RPC (SECURITY DEFINER; callable by anon + authenticated)
CREATE OR REPLACE FUNCTION public.redeem_portal_invite(
  _code text,
  _corporate_id text,
  _ip inet DEFAULT NULL,
  _user_agent text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_invite public.portal_invites;
  v_session_id uuid;
  v_token uuid;
  v_expires timestamptz;
BEGIN
  IF _code IS NULL OR length(trim(_code)) = 0 THEN
    RAISE EXCEPTION 'invalid_code' USING ERRCODE = 'P0001';
  END IF;
  IF _corporate_id IS NULL OR length(trim(_corporate_id)) < 2 THEN
    RAISE EXCEPTION 'invalid_corporate_id' USING ERRCODE = 'P0001';
  END IF;

  SELECT * INTO v_invite
  FROM public.portal_invites
  WHERE code = trim(_code) AND is_active = true
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'invalid_code' USING ERRCODE = 'P0001';
  END IF;

  IF v_invite.expires_at IS NOT NULL AND v_invite.expires_at < now() THEN
    RAISE EXCEPTION 'invalid_code' USING ERRCODE = 'P0001';
  END IF;

  IF v_invite.uses_count >= v_invite.max_uses THEN
    RAISE EXCEPTION 'invalid_code' USING ERRCODE = 'P0001';
  END IF;

  v_expires := now() + interval '30 days';

  INSERT INTO public.portal_sessions (invite_id, corporate_id, ip_address, user_agent, expires_at)
  VALUES (v_invite.id, trim(_corporate_id), _ip, _user_agent, v_expires)
  RETURNING id, token INTO v_session_id, v_token;

  UPDATE public.portal_invites
  SET uses_count = uses_count + 1,
      is_active = CASE WHEN uses_count + 1 >= max_uses THEN false ELSE is_active END
  WHERE id = v_invite.id;

  INSERT INTO public.portal_redemptions (invite_id, session_id, corporate_id, ip_address, user_agent)
  VALUES (v_invite.id, v_session_id, trim(_corporate_id), _ip, _user_agent);

  RETURN jsonb_build_object(
    'token', v_token,
    'expires_at', v_expires,
    'invited_name', v_invite.invited_name,
    'invited_company', v_invite.invited_company
  );
END;
$$;

REVOKE ALL ON FUNCTION public.redeem_portal_invite(text, text, inet, text) FROM public;
GRANT EXECUTE ON FUNCTION public.redeem_portal_invite(text, text, inet, text) TO anon, authenticated;

-- 7. Validate session RPC
CREATE OR REPLACE FUNCTION public.validate_portal_session(_token uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.portal_sessions;
BEGIN
  IF _token IS NULL THEN RETURN jsonb_build_object('valid', false); END IF;

  SELECT * INTO v_row FROM public.portal_sessions WHERE token = _token;
  IF NOT FOUND THEN RETURN jsonb_build_object('valid', false); END IF;
  IF v_row.revoked_at IS NOT NULL OR v_row.expires_at < now() THEN
    RETURN jsonb_build_object('valid', false);
  END IF;

  UPDATE public.portal_sessions SET last_seen_at = now() WHERE id = v_row.id;

  RETURN jsonb_build_object(
    'valid', true,
    'expires_at', v_row.expires_at,
    'corporate_id', v_row.corporate_id
  );
END;
$$;

REVOKE ALL ON FUNCTION public.validate_portal_session(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.validate_portal_session(uuid) TO anon, authenticated;