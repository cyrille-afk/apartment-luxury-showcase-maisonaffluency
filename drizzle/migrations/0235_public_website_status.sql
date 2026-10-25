CREATE TABLE public.website_status (path text PRIMARY KEY CHECK (path IN ('/','/designers','/gallery','/trade-program')), available boolean NOT NULL, checked_at timestamptz NOT NULL);
GRANT SELECT ON public.website_status TO anon, authenticated;
GRANT ALL ON public.website_status TO service_role;
ALTER TABLE public.website_status ENABLE ROW LEVEL SECURITY;
CREATE POLICY website_status_public_read ON public.website_status FOR SELECT TO anon, authenticated USING (true);
CREATE TABLE public.website_status_incidents (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), path text NOT NULL CHECK (path IN ('/','/designers','/gallery','/trade-program')), started_at timestamptz NOT NULL, resolved_at timestamptz);
GRANT SELECT ON public.website_status_incidents TO anon, authenticated;
GRANT ALL ON public.website_status_incidents TO service_role;
ALTER TABLE public.website_status_incidents ENABLE ROW LEVEL SECURITY;
CREATE POLICY website_incidents_public_read ON public.website_status_incidents FOR SELECT TO anon, authenticated USING (true);
CREATE UNIQUE INDEX website_status_one_open_incident ON public.website_status_incidents(path) WHERE resolved_at IS NULL;
CREATE INDEX website_status_incident_dates ON public.website_status_incidents(started_at DESC);
CREATE FUNCTION public.capture_public_website_status() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
 IF NEW.path NOT IN ('/','/designers','/gallery','/trade-program') THEN RETURN NEW; END IF;
 INSERT INTO public.website_status(path,available,checked_at) VALUES(NEW.path,NEW.consecutive_failures=0,NEW.last_checked_at) ON CONFLICT(path) DO UPDATE SET available=EXCLUDED.available,checked_at=EXCLUDED.checked_at;
 IF NEW.consecutive_failures>0 THEN
 INSERT INTO public.website_status_incidents(path,started_at) VALUES(NEW.path,NEW.last_checked_at) ON CONFLICT(path) WHERE resolved_at IS NULL DO NOTHING;
 ELSE
 UPDATE public.website_status_incidents SET resolved_at=NEW.last_checked_at WHERE path=NEW.path AND resolved_at IS NULL;
 END IF;
 RETURN NEW;
END; $$;
REVOKE ALL ON FUNCTION public.capture_public_website_status() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER capture_public_website_status AFTER INSERT OR UPDATE ON public.uptime_monitor_state FOR EACH ROW EXECUTE FUNCTION public.capture_public_website_status();
INSERT INTO public.website_status(path,available,checked_at) SELECT path,consecutive_failures=0,last_checked_at FROM public.uptime_monitor_state WHERE path IN ('/','/designers','/gallery','/trade-program');
INSERT INTO public.website_status_incidents(path,started_at) SELECT path,last_checked_at FROM public.uptime_monitor_state WHERE path IN ('/','/designers','/gallery','/trade-program') AND consecutive_failures>0;