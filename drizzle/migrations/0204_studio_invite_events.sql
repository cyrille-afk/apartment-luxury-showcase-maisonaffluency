CREATE TABLE public.studio_invite_events (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 studio_id uuid NOT NULL,
 invite_id uuid NOT NULL,
 email text NOT NULL,
 role public.studio_role,
 event text NOT NULL CHECK (event IN ('created','emailed','accepted','revoked')),
 actor_id uuid,
 created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.studio_invite_events TO service_role;
ALTER TABLE public.studio_invite_events ENABLE ROW LEVEL SECURITY;
CREATE INDEX studio_invite_events_studio_idx ON public.studio_invite_events (studio_id, created_at DESC);

-- Backfill what history already exists.
INSERT INTO public.studio_invite_events (studio_id, invite_id, email, role, event, actor_id, created_at)
SELECT studio_id, id, email, role, 'created', invited_by, created_at FROM public.studio_invites;
INSERT INTO public.studio_invite_events (studio_id, invite_id, email, role, event, actor_id, created_at)
SELECT studio_id, id, email, role, 'accepted', accepted_by, accepted_at FROM public.studio_invites WHERE accepted_at IS NOT NULL;

CREATE OR REPLACE FUNCTION public.log_studio_invite_event() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
 IF TG_OP = 'INSERT' THEN
  INSERT INTO public.studio_invite_events (studio_id, invite_id, email, role, event, actor_id)
  VALUES (NEW.studio_id, NEW.id, NEW.email, NEW.role, 'created', COALESCE(NEW.invited_by, auth.uid()));
  RETURN NEW;
 ELSIF TG_OP = 'UPDATE' THEN
  IF OLD.accepted_at IS NULL AND NEW.accepted_at IS NOT NULL THEN
   INSERT INTO public.studio_invite_events (studio_id, invite_id, email, role, event, actor_id, created_at)
   VALUES (NEW.studio_id, NEW.id, NEW.email, NEW.role, 'accepted', COALESCE(NEW.accepted_by, auth.uid()), NEW.accepted_at);
  END IF;
  RETURN NEW;
 ELSE
  IF OLD.accepted_at IS NULL THEN
   INSERT INTO public.studio_invite_events (studio_id, invite_id, email, role, event, actor_id)
   VALUES (OLD.studio_id, OLD.id, OLD.email, OLD.role, 'revoked', auth.uid());
  END IF;
  RETURN OLD;
 END IF;
END; $$;
CREATE TRIGGER studio_invite_events_log AFTER INSERT OR UPDATE OF accepted_at OR DELETE ON public.studio_invites
FOR EACH ROW EXECUTE FUNCTION public.log_studio_invite_event();

CREATE OR REPLACE FUNCTION public.admin_studio_invite_history(_studio_id uuid)
RETURNS TABLE(invite_id uuid, email text, role public.studio_role, event text, actor_name text, occurred_at timestamptz)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
 IF auth.uid() IS NULL OR NOT (public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'super_admin'::public.app_role)) THEN
  RAISE EXCEPTION 'Administrator access required' USING ERRCODE = '42501';
 END IF;
 RETURN QUERY
 WITH ev AS (
  SELECT e.invite_id, e.email, e.role,
   CASE WHEN e.event = 'emailed' AND row_number() OVER (PARTITION BY e.invite_id, (e.event = 'emailed') ORDER BY e.created_at) > 1 THEN 'resent'
        WHEN e.event = 'emailed' THEN 'sent' ELSE e.event END AS event,
   e.actor_id, e.created_at
  FROM public.studio_invite_events e WHERE e.studio_id = _studio_id
  UNION ALL
  SELECT i.id, i.email, i.role, 'expired', NULL::uuid, i.expires_at
  FROM public.studio_invites i WHERE i.studio_id = _studio_id AND i.accepted_at IS NULL AND i.expires_at < now()
 )
 SELECT ev.invite_id, ev.email, ev.role, ev.event,
  COALESCE(NULLIF(TRIM(CONCAT(p.first_name, ' ', p.last_name)), ''), p.email),
  ev.created_at
 FROM ev LEFT JOIN public.profiles p ON p.id = ev.actor_id
 ORDER BY ev.created_at DESC LIMIT 200;
END; $$;
REVOKE ALL ON FUNCTION public.admin_studio_invite_history(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_studio_invite_history(uuid) TO authenticated;