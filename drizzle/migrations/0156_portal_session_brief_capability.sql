-- Short-lived, session-scoped capability for attaching concierge briefs to a portal session.
-- No owner column needed: the capability is minted at redemption, stored hashed,
-- expires after 24h, and is renewed by validate_portal_session.

ALTER TABLE public.portal_sessions
  ADD COLUMN IF NOT EXISTS brief_capability_hash text,
  ADD COLUMN IF NOT EXISTS brief_capability_expires_at timestamptz;

-- Mint a fresh capability at redemption; plaintext returned once to the redeemer.
CREATE OR REPLACE FUNCTION public.redeem_portal_invite(_code text, _corporate_id text, _ip inet DEFAULT NULL::inet, _user_agent text DEFAULT NULL::text) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
AS $$
DECLARE
  v_invite public.portal_invites;
  v_session_id uuid;
  v_token uuid;
  v_expires timestamptz;
  v_cap text;
  v_cap_expires timestamptz;
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
  v_cap := gen_random_uuid()::text || gen_random_uuid()::text;
  v_cap_expires := now() + interval '24 hours';

  INSERT INTO public.portal_sessions (invite_id, corporate_id, ip_address, user_agent, expires_at, brief_capability_hash, brief_capability_expires_at)
  VALUES (v_invite.id, trim(_corporate_id), _ip, _user_agent, v_expires, encode(digest(v_cap, 'sha256'), 'hex'), v_cap_expires)
  RETURNING id, token INTO v_session_id, v_token;

  UPDATE public.portal_invites
  SET uses_count = uses_count + 1,
      is_active = CASE WHEN uses_count + 1 >= max_uses THEN false ELSE is_active END
  WHERE id = v_invite.id;

  INSERT INTO public.portal_redemptions (invite_id, session_id, corporate_id, ip_address, user_agent)
  VALUES (v_invite.id, v_session_id, trim(_corporate_id), _ip, _user_agent);

  RETURN jsonb_build_object(
    'token', v_token,
    'session_id', v_session_id,
    'expires_at', v_expires,
    'invited_name', v_invite.invited_name,
    'invited_company', v_invite.invited_company,
    'brief_capability', v_cap,
    'brief_capability_expires_at', v_cap_expires
  );
END;
$$;

-- validate_portal_session renews the capability when missing or expiring within 12h,
-- so the capability stays short-lived while the session remains active.
CREATE OR REPLACE FUNCTION public.validate_portal_session(_token uuid) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
AS $$
DECLARE
  v_row public.portal_sessions;
  v_cap text;
  v_cap_expires timestamptz;
BEGIN
  IF _token IS NULL THEN RETURN jsonb_build_object('valid', false); END IF;

  SELECT * INTO v_row FROM public.portal_sessions WHERE token = _token;
  IF NOT FOUND THEN RETURN jsonb_build_object('valid', false); END IF;
  IF v_row.revoked_at IS NOT NULL OR v_row.expires_at < now() THEN
    RETURN jsonb_build_object('valid', false); END IF;

  UPDATE public.portal_sessions SET last_seen_at = now() WHERE id = v_row.id;

  IF v_row.brief_capability_hash IS NULL
     OR v_row.brief_capability_expires_at IS NULL
     OR v_row.brief_capability_expires_at < now() + interval '12 hours' THEN
    v_cap := gen_random_uuid()::text || gen_random_uuid()::text;
    v_cap_expires := now() + interval '24 hours';
    UPDATE public.portal_sessions
    SET brief_capability_hash = encode(digest(v_cap, 'sha256'), 'hex'),
        brief_capability_expires_at = v_cap_expires
    WHERE id = v_row.id;
  END IF;

  RETURN jsonb_build_object(
    'valid', true,
    'expires_at', v_row.expires_at,
    'corporate_id', v_row.corporate_id,
    'session_id', v_row.id,
    'brief_capability', v_cap,
    'brief_capability_expires_at', v_cap_expires
  );
END;
$$;