
-- =====================================================================
-- 1) client_boards.client_email — owner-only via column GRANT + RPC
-- =====================================================================
REVOKE SELECT (client_email) ON public.client_boards FROM authenticated;
-- Re-grant SELECT on every other column to authenticated (preserve existing access)
GRANT SELECT (
  id, user_id, studio_id, project_id, title, client_name, status,
  share_token, token_expires_at, token_rotated_at,
  studio_name, studio_logo_url, hide_maison_branding,
  created_at, updated_at
) ON public.client_boards TO authenticated;

CREATE OR REPLACE FUNCTION public.get_board_client_email(_board_id uuid)
RETURNS text
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _email text;
  _owner uuid;
BEGIN
  SELECT user_id, client_email INTO _owner, _email
  FROM public.client_boards WHERE id = _board_id;
  IF _owner IS NULL THEN RETURN NULL; END IF;
  IF _owner = auth.uid() OR public.has_role(auth.uid(), 'admin'::app_role) THEN
    RETURN _email;
  END IF;
  RETURN NULL;
END;
$$;
REVOKE ALL ON FUNCTION public.get_board_client_email(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_board_client_email(uuid) TO authenticated;

-- =====================================================================
-- 2) clients — tax_id + billing address: editor+ only
--    Tighten the SELECT policy from can_view_studio (viewer+) to can_edit_studio (editor+).
-- =====================================================================
DROP POLICY IF EXISTS "Studio members view clients" ON public.clients;
CREATE POLICY "Studio editors view clients"
  ON public.clients FOR SELECT
  USING (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.can_edit_studio(auth.uid(), studio_id)
  );

-- =====================================================================
-- 3) order_timeline — restrict shipping PII to owner/platform admin
--    Replace "View timelines (owner or admin)" so studio admins lose row read.
--    Editors keep UPDATE rights via the existing "Update timelines" policy.
-- =====================================================================
DROP POLICY IF EXISTS "View timelines (owner or admin)" ON public.order_timeline;
CREATE POLICY "View timelines (owner or platform admin)"
  ON public.order_timeline FOR SELECT
  USING (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR user_id = auth.uid()
  );

-- =====================================================================
-- 4) studio_payout_accounts — owner-only (not all studio admins)
-- =====================================================================
DROP POLICY IF EXISTS "Payout accounts read (admins only)" ON public.studio_payout_accounts;
DROP POLICY IF EXISTS "Studio admins manage payout accounts" ON public.studio_payout_accounts;

CREATE POLICY "Payout accounts read (owner or platform admin)"
  ON public.studio_payout_accounts FOR SELECT
  USING (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.is_studio_owner(auth.uid(), studio_id)
  );
CREATE POLICY "Payout accounts write (owner or platform admin)"
  ON public.studio_payout_accounts FOR ALL
  USING (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.is_studio_owner(auth.uid(), studio_id)
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.is_studio_owner(auth.uid(), studio_id)
  );

-- =====================================================================
-- 5) studio_submissions — DB-level rate limit (3 per email / 24h)
-- =====================================================================
CREATE OR REPLACE FUNCTION public.tg_studio_submissions_rate_limit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _recent int;
BEGIN
  IF NEW.email IS NULL OR btrim(NEW.email) = '' THEN
    RETURN NEW;
  END IF;
  SELECT count(*) INTO _recent
  FROM public.studio_submissions
  WHERE lower(email) = lower(NEW.email)
    AND created_at > now() - interval '24 hours';
  IF _recent >= 3 THEN
    RAISE EXCEPTION 'Rate limit: too many submissions for this email in the last 24 hours';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_studio_submissions_rate_limit ON public.studio_submissions;
CREATE TRIGGER trg_studio_submissions_rate_limit
  BEFORE INSERT ON public.studio_submissions
  FOR EACH ROW EXECUTE FUNCTION public.tg_studio_submissions_rate_limit();
