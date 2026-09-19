
-- Table to record raw security-relevant events
CREATE TABLE IF NOT EXISTS public.security_audit_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  occurred_at timestamptz NOT NULL DEFAULT now(),
  event_type text NOT NULL,            -- 'edge_unauthorized','edge_forbidden','storage_unexpected_write'
  source text NOT NULL,                -- function name or bucket id
  user_id uuid,
  ip text,
  details jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_sec_audit_events_time ON public.security_audit_events (occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_sec_audit_events_type_time ON public.security_audit_events (event_type, occurred_at DESC);

ALTER TABLE public.security_audit_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins read security events" ON public.security_audit_events;
CREATE POLICY "Admins read security events" ON public.security_audit_events
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

-- No INSERT policy: only service role / SECURITY DEFINER funcs may write

-- Tracks alert dedup + last scan window
CREATE TABLE IF NOT EXISTS public.security_alert_state (
  id text PRIMARY KEY,
  last_alerted_at timestamptz,
  payload jsonb
);
ALTER TABLE public.security_alert_state ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admins read alert state" ON public.security_alert_state;
CREATE POLICY "Admins read alert state" ON public.security_alert_state
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

-- Helper RPC callable by edge functions (with service role) to record events
CREATE OR REPLACE FUNCTION public.record_security_event(
  _event_type text,
  _source text,
  _user_id uuid DEFAULT NULL,
  _ip text DEFAULT NULL,
  _details jsonb DEFAULT '{}'::jsonb
) RETURNS uuid
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  INSERT INTO public.security_audit_events (event_type, source, user_id, ip, details)
  VALUES (_event_type, _source, _user_id, _ip, COALESCE(_details, '{}'::jsonb))
  RETURNING id;
$$;

REVOKE ALL ON FUNCTION public.record_security_event(text,text,uuid,text,jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_security_event(text,text,uuid,text,jsonb) TO service_role;

-- Storage trigger: flag writes outside expected bucket/path conventions.
-- Expected: avatars/{auth_uid}/..., client-documents/{studio}/..., spec-sheets/*, designer-images/*, assets/*, floor-plans/*, backups/*
CREATE OR REPLACE FUNCTION public.flag_unexpected_storage_write()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _allowed_buckets text[] := ARRAY['assets','avatars','designer-images','spec-sheets','floor-plans','client-documents','backups'];
  _suspicious boolean := false;
  _reason text := '';
BEGIN
  IF NEW.bucket_id IS NULL OR NOT (NEW.bucket_id = ANY(_allowed_buckets)) THEN
    _suspicious := true;
    _reason := 'unknown_bucket';
  ELSIF NEW.bucket_id = 'avatars' AND NEW.owner IS NOT NULL
        AND (storage.foldername(NEW.name))[1] IS DISTINCT FROM NEW.owner::text THEN
    _suspicious := true;
    _reason := 'avatar_path_mismatch';
  ELSIF NEW.name ~* '\.(php|sh|exe|bat|cmd|ps1|jsp)$' THEN
    _suspicious := true;
    _reason := 'executable_extension';
  END IF;

  IF _suspicious THEN
    INSERT INTO public.security_audit_events (event_type, source, user_id, details)
    VALUES (
      'storage_unexpected_write',
      COALESCE(NEW.bucket_id, 'unknown'),
      NEW.owner,
      jsonb_build_object('reason', _reason, 'object_name', NEW.name, 'size', NEW.metadata->'size')
    );
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_flag_unexpected_storage_write ON storage.objects;
CREATE TRIGGER trg_flag_unexpected_storage_write
AFTER INSERT ON storage.objects
FOR EACH ROW EXECUTE FUNCTION public.flag_unexpected_storage_write();
