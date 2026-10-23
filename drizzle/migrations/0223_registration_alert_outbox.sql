-- lovable-cron-fallback-reviewed: event-driven immediate dispatch; minute retries armed only for pending alert events and disarmed after drain
CREATE TABLE public.registration_alert_events (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), event_type text NOT NULL, source_id uuid NOT NULL, source_table text NOT NULL, email_done jsonb NOT NULL DEFAULT '{}'::jsonb, whatsapp_done jsonb NOT NULL DEFAULT '{}'::jsonb, status text NOT NULL DEFAULT 'pending', attempts integer NOT NULL DEFAULT 0, lease_until timestamptz, next_attempt_at timestamptz NOT NULL DEFAULT now(), last_error text, created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(event_type, source_id));
GRANT ALL ON public.registration_alert_events TO service_role;
ALTER TABLE public.registration_alert_events ENABLE ROW LEVEL SECURITY;
CREATE OR REPLACE FUNCTION public.dispatch_registration_alerts() RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ BEGIN
IF EXISTS(SELECT 1 FROM public.registration_alert_events WHERE status='pending') THEN
PERFORM net.http_post(url:='https://dcrauiygaezoduwdjmsm.supabase.co/functions/v1/notify-new-registration',headers:=jsonb_build_object('Content-Type','application/json','x-internal-token',public._internal_job_token()),body:='{}'::jsonb);
ELSE PERFORM cron.unschedule(jobid) FROM cron.job WHERE jobname='registration-alert-retry'; END IF;
END $$;
REVOKE ALL ON FUNCTION public.dispatch_registration_alerts() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.dispatch_registration_alerts() TO service_role;
CREATE OR REPLACE FUNCTION public.queue_registration_alert() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ BEGIN
INSERT INTO public.registration_alert_events(event_type,source_id,source_table) VALUES(CASE WHEN TG_TABLE_NAME='profiles' THEN 'new_account' ELSE 'trade_application' END,NEW.id,TG_TABLE_NAME) ON CONFLICT DO NOTHING;
PERFORM pg_advisory_xact_lock(77231023);
IF NOT EXISTS(SELECT 1 FROM cron.job WHERE jobname='registration-alert-retry') THEN PERFORM cron.schedule('registration-alert-retry','* * * * *','SELECT public.dispatch_registration_alerts();'); END IF;
PERFORM public.dispatch_registration_alerts();
RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.queue_registration_alert() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER queue_new_account_alert AFTER INSERT ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.queue_registration_alert();
CREATE TRIGGER queue_trade_account_alert AFTER INSERT ON public.trade_accounts FOR EACH ROW EXECUTE FUNCTION public.queue_registration_alert();
CREATE TRIGGER queue_trade_application_alert AFTER INSERT ON public.trade_applications FOR EACH ROW EXECUTE FUNCTION public.queue_registration_alert();
CREATE OR REPLACE FUNCTION public.claim_registration_alerts() RETURNS SETOF public.registration_alert_events LANGUAGE sql SECURITY DEFINER SET search_path=public AS $$ UPDATE public.registration_alert_events SET lease_until=now()+interval '2 minutes',attempts=attempts+1 WHERE id IN(SELECT id FROM public.registration_alert_events WHERE status='pending' AND next_attempt_at<=now() AND (lease_until IS NULL OR lease_until<now()) ORDER BY created_at FOR UPDATE SKIP LOCKED LIMIT 5) RETURNING * $$;
REVOKE ALL ON FUNCTION public.claim_registration_alerts() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.claim_registration_alerts() TO service_role;