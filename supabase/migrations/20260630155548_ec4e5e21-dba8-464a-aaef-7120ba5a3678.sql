-- 1) Fix is_studio_owner to query studio_members against studios (not featured_studios)
CREATE OR REPLACE FUNCTION public.is_studio_owner(_user_id uuid, _studio_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.studio_members sm
    JOIN public.studios s ON s.id = sm.studio_id
    WHERE sm.studio_id = _studio_id
      AND sm.user_id   = _user_id
      AND sm.role      = 'owner'::public.studio_role
  );
$function$;

-- 2) studio_invites: ensure token is never selectable by authenticated.
-- Re-revoke and re-grant explicit per-column SELECT excluding token.
REVOKE SELECT ON public.studio_invites FROM authenticated;
GRANT SELECT (
  id, studio_id, email, role, invited_by, accepted_at, accepted_by, expires_at, created_at
) ON public.studio_invites TO authenticated;
GRANT ALL ON public.studio_invites TO service_role;

COMMENT ON COLUMN public.studio_invites.token IS
  'Secret invite token. SELECT restricted to service_role via column-level grants. Never expose to authenticated/anon.';

-- 3) order_timeline: prevent non-owner studio editors from modifying ship-to PII columns.
-- SELECT is already owner/admin only; this trigger blocks PII writes via UPDATE so the
-- editor UPDATE policy cannot be abused to overwrite or probe ship-to PII.
CREATE OR REPLACE FUNCTION public.tg_order_timeline_guard_ship_to_pii()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;
  -- Owner of the timeline and platform admins may freely modify PII.
  IF NEW.user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'::app_role) THEN
    RETURN NEW;
  END IF;
  -- For all other writers (studio editors), reject any change to ship-to PII columns.
  IF NEW.ship_to_name        IS DISTINCT FROM OLD.ship_to_name
  OR NEW.ship_to_attention   IS DISTINCT FROM OLD.ship_to_attention
  OR NEW.ship_to_email       IS DISTINCT FROM OLD.ship_to_email
  OR NEW.ship_to_phone       IS DISTINCT FROM OLD.ship_to_phone
  OR NEW.ship_to_address1    IS DISTINCT FROM OLD.ship_to_address1
  OR NEW.ship_to_address2    IS DISTINCT FROM OLD.ship_to_address2
  OR NEW.ship_to_city        IS DISTINCT FROM OLD.ship_to_city
  OR NEW.ship_to_state       IS DISTINCT FROM OLD.ship_to_state
  OR NEW.ship_to_postal_code IS DISTINCT FROM OLD.ship_to_postal_code
  OR NEW.ship_to_country     IS DISTINCT FROM OLD.ship_to_country
  OR NEW.ship_to_notes       IS DISTINCT FROM OLD.ship_to_notes
  THEN
    RAISE EXCEPTION 'Only the timeline owner or a platform admin may modify ship-to PII';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS order_timeline_guard_ship_to_pii ON public.order_timeline;
CREATE TRIGGER order_timeline_guard_ship_to_pii
  BEFORE UPDATE ON public.order_timeline
  FOR EACH ROW EXECUTE FUNCTION public.tg_order_timeline_guard_ship_to_pii();