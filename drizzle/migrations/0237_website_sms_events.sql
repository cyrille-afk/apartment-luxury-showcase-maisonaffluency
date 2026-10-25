CREATE TABLE public.website_sms_events(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), incident_id uuid NOT NULL REFERENCES public.website_status_incidents(id), event_kind text NOT NULL CHECK(event_kind IN ('outage','recovery')), status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','sending','accepted','failed','uncertain')), provider_id text, error text, created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(incident_id,event_kind));
GRANT ALL ON public.website_sms_events TO service_role;
REVOKE ALL ON public.website_sms_events FROM anon,authenticated;
ALTER TABLE public.website_sms_events ENABLE ROW LEVEL SECURITY;
CREATE TABLE public.website_sms_config(id boolean PRIMARY KEY DEFAULT true CHECK(id), callback_url text, enabled boolean NOT NULL DEFAULT false);
GRANT ALL ON public.website_sms_config TO service_role;
REVOKE ALL ON public.website_sms_config FROM anon,authenticated;
ALTER TABLE public.website_sms_config ENABLE ROW LEVEL SECURITY;
CREATE TABLE public.website_sms_wakes(token_hash text PRIMARY KEY, event_id uuid NOT NULL REFERENCES public.website_sms_events(id),expires_at timestamptz NOT NULL DEFAULT now()+interval '10 minutes');
GRANT ALL ON public.website_sms_wakes TO service_role;
REVOKE ALL ON public.website_sms_wakes FROM anon,authenticated;
ALTER TABLE public.website_sms_wakes ENABLE ROW LEVEL SECURITY;
CREATE FUNCTION public.dispatch_website_sms() RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,extensions AS $$
DECLARE target text; item record; token text;
BEGIN
 PERFORM pg_advisory_xact_lock(731904);
 SELECT callback_url INTO target FROM public.website_sms_config WHERE id AND enabled;
 IF target IS NULL THEN RETURN; END IF;
 DELETE FROM public.website_sms_wakes WHERE expires_at<now();
 FOR item IN SELECT id FROM public.website_sms_events e WHERE status='pending' AND NOT EXISTS(SELECT 1 FROM public.website_sms_wakes w WHERE w.event_id=e.id AND w.expires_at>now()) ORDER BY created_at LIMIT 8 LOOP
 token:=encode(gen_random_bytes(32),'hex');
 INSERT INTO public.website_sms_wakes(token_hash,event_id) VALUES(encode(digest(token,'sha256'),'hex'),item.id);
 PERFORM net.http_post(url:=target,headers:=jsonb_build_object('Content-Type','application/json','Authorization','Bearer '||token),body:='{}'::jsonb,timeout_milliseconds:=30000);
 END LOOP;
END; $$;
REVOKE ALL ON FUNCTION public.dispatch_website_sms() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.dispatch_website_sms() TO service_role;
CREATE FUNCTION public.enqueue_website_sms() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF TG_OP='INSERT' THEN
 INSERT INTO public.website_sms_events(incident_id,event_kind) VALUES(NEW.id,'outage') ON CONFLICT DO NOTHING;
 ELSIF OLD.resolved_at IS NULL AND NEW.resolved_at IS NOT NULL THEN
 INSERT INTO public.website_sms_events(incident_id,event_kind) VALUES(NEW.id,'recovery') ON CONFLICT DO NOTHING;
 END IF;
 RETURN NEW;
END; $$;
REVOKE ALL ON FUNCTION public.enqueue_website_sms() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER enqueue_website_sms AFTER INSERT OR UPDATE ON public.website_status_incidents FOR EACH ROW EXECUTE FUNCTION public.enqueue_website_sms();
CREATE FUNCTION public.wake_website_sms() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ BEGIN PERFORM public.dispatch_website_sms(); RETURN NEW; END; $$;
REVOKE ALL ON FUNCTION public.wake_website_sms() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER wake_website_sms AFTER INSERT OR UPDATE ON public.website_status FOR EACH STATEMENT EXECUTE FUNCTION public.wake_website_sms();
CREATE FUNCTION public.claim_website_sms(wake_token text) RETURNS SETOF public.website_sms_events LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,extensions AS $$
DECLARE item uuid;
BEGIN
 DELETE FROM public.website_sms_wakes WHERE token_hash=encode(digest(wake_token,'sha256'),'hex') AND expires_at>now() RETURNING event_id INTO item;
 IF item IS NULL THEN RAISE EXCEPTION 'Unauthorized' USING ERRCODE='28000'; END IF;
 RETURN QUERY UPDATE public.website_sms_events SET status='sending' WHERE id=item AND status='pending' RETURNING *;
END; $$;
REVOKE ALL ON FUNCTION public.claim_website_sms(text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.claim_website_sms(text) TO service_role;