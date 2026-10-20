ALTER TABLE public.trade_accounts ADD COLUMN IF NOT EXISTS instagram_retry_after timestamptz, ADD COLUMN IF NOT EXISTS instagram_retry_claimed_at timestamptz;
CREATE OR REPLACE FUNCTION public.claim_instagram_verification_retries() RETURNS TABLE(id uuid) LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ BEGIN
 RETURN QUERY WITH candidates AS (SELECT a.id FROM public.trade_accounts a WHERE a.radar_status='unverified' AND (a.instagram_retry_after IS NULL OR a.instagram_retry_after<=now()) AND (a.instagram_retry_claimed_at IS NULL OR a.instagram_retry_claimed_at<now()-interval '10 minutes') ORDER BY a.instagram_retry_after NULLS FIRST,a.created_at LIMIT 3 FOR UPDATE SKIP LOCKED) UPDATE public.trade_accounts a SET instagram_retry_after=now()+interval '1 day',instagram_retry_claimed_at=now() FROM candidates c WHERE a.id=c.id RETURNING a.id;
END $$;
REVOKE ALL ON FUNCTION public.claim_instagram_verification_retries() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.claim_instagram_verification_retries() TO service_role;
CREATE OR REPLACE FUNCTION public.instagram_retry_dispatch() RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ BEGIN
 PERFORM pg_advisory_xact_lock(7700000000000011);
 IF NOT EXISTS(SELECT 1 FROM public.trade_accounts WHERE radar_status='unverified') THEN
 IF EXISTS(SELECT 1 FROM cron.job WHERE jobname='instagram-verification-retries') THEN PERFORM cron.unschedule('instagram-verification-retries'); END IF;
 RETURN; END IF;
 PERFORM net.http_post(url:='https://dcrauiygaezoduwdjmsm.supabase.co/functions/v1/retry-instagram-verification',headers:=jsonb_build_object('Content-Type','application/json','x-internal-token',public._internal_job_token()),body:='{}'::jsonb,timeout_milliseconds:=10000);
END $$;
REVOKE ALL ON FUNCTION public.instagram_retry_dispatch() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.instagram_retry_dispatch() TO service_role;
CREATE OR REPLACE FUNCTION public.instagram_retry_wake() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ BEGIN
 PERFORM pg_advisory_xact_lock(7700000000000011);
 IF EXISTS(SELECT 1 FROM public.trade_accounts WHERE radar_status='unverified') THEN
 IF NOT EXISTS(SELECT 1 FROM cron.job WHERE jobname='instagram-verification-retries') THEN PERFORM cron.schedule('instagram-verification-retries','0 4 * * *','SELECT public.instagram_retry_dispatch()'); END IF;
 IF TG_TABLE_NAME='integration_tokens' THEN UPDATE public.trade_accounts SET instagram_retry_after=NULL WHERE radar_status='unverified'; END IF;
 PERFORM public.instagram_retry_dispatch();
 ELSE PERFORM public.instagram_retry_dispatch(); END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.instagram_retry_wake() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER instagram_retry_account_wake AFTER INSERT OR UPDATE OF radar_status ON public.trade_accounts FOR EACH ROW EXECUTE FUNCTION public.instagram_retry_wake();
CREATE TRIGGER instagram_retry_connection_wake AFTER INSERT OR UPDATE ON public.integration_tokens FOR EACH ROW WHEN (NEW.provider='meta') EXECUTE FUNCTION public.instagram_retry_wake();