ALTER TABLE public.trade_accounts ADD COLUMN instagram_retry_blocked_source text;
COMMENT ON COLUMN public.trade_accounts.instagram_retry_blocked_source IS 'Submitted source with a confirmed permanent Instagram handle failure; automatic retries resume when the source changes. Not an approval or score.';
UPDATE public.trade_accounts a SET instagram_retry_blocked_source=a.website_or_ig FROM public.studio_aesthetic_dna d WHERE d.trade_account_id=a.id AND d.error ILIKE 'Instagram connection is working,%' AND d.error ~* '(invalid user id|not found or not a business/creator account|(username|user|profile|account|handle) (was )?not found)' AND d.error !~* '(temporary|timeout|timed out|rate limit|too many requests|\m429\M|\m5[0-9][0-9]\M|invalid.*token|expired.*token)';
CREATE OR REPLACE FUNCTION public._instagram_retry_eligible(a public.trade_accounts) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT a.status IS DISTINCT FROM 'approved' AND a.radar_status='unverified'
 AND (btrim(coalesce(a.website_or_ig,'')) ~ '^@[A-Za-z0-9._]{1,30}$' OR btrim(coalesce(a.website_or_ig,'')) ~ '^[A-Za-z0-9_]{1,30}$' OR btrim(coalesce(a.website_or_ig,'')) ~* '^(https?://)?(www\.)?instagram\.com/[A-Za-z0-9._]{1,30}/?([?#].*)?$')
 AND (a.instagram_retry_blocked_source IS NULL OR a.instagram_retry_blocked_source IS DISTINCT FROM a.website_or_ig)
$$;
REVOKE ALL ON FUNCTION public._instagram_retry_eligible(public.trade_accounts) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public._instagram_retry_eligible(public.trade_accounts) TO service_role;
CREATE OR REPLACE FUNCTION public.claim_instagram_verification_retries() RETURNS TABLE(id uuid) LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ BEGIN
 RETURN QUERY WITH candidates AS (SELECT a.id FROM public.trade_accounts a WHERE public._instagram_retry_eligible(a) AND (a.instagram_retry_after IS NULL OR a.instagram_retry_after<=now()) AND (a.instagram_retry_claimed_at IS NULL OR a.instagram_retry_claimed_at<now()-interval '10 minutes') ORDER BY a.instagram_retry_after NULLS FIRST,a.created_at LIMIT 3 FOR UPDATE SKIP LOCKED) UPDATE public.trade_accounts a SET instagram_retry_after=now()+interval '1 day',instagram_retry_claimed_at=now() FROM candidates c WHERE a.id=c.id RETURNING a.id;
END $$;
REVOKE ALL ON FUNCTION public.claim_instagram_verification_retries() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.claim_instagram_verification_retries() TO service_role;
CREATE OR REPLACE FUNCTION public.instagram_retry_dispatch() RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ BEGIN
 PERFORM pg_advisory_xact_lock(7700000000000011);
 IF NOT EXISTS(SELECT 1 FROM public.trade_accounts a WHERE public._instagram_retry_eligible(a)) THEN
  IF EXISTS(SELECT 1 FROM cron.job WHERE jobname='instagram-verification-retries') THEN PERFORM cron.unschedule('instagram-verification-retries'); END IF;
  RETURN;
 END IF;
 IF NOT EXISTS(SELECT 1 FROM public.trade_accounts a WHERE public._instagram_retry_eligible(a) AND (a.instagram_retry_after IS NULL OR a.instagram_retry_after<=now()) AND (a.instagram_retry_claimed_at IS NULL OR a.instagram_retry_claimed_at<now()-interval '10 minutes')) THEN RETURN; END IF;
 PERFORM net.http_post(url:='https://dcrauiygaezoduwdjmsm.supabase.co/functions/v1/retry-instagram-verification',headers:=jsonb_build_object('Content-Type','application/json','x-internal-token',public._internal_job_token()),body:='{}'::jsonb,timeout_milliseconds:=10000);
END $$;
REVOKE ALL ON FUNCTION public.instagram_retry_dispatch() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.instagram_retry_dispatch() TO service_role;
CREATE OR REPLACE FUNCTION public.instagram_retry_wake() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ BEGIN
 PERFORM pg_advisory_xact_lock(7700000000000011);
 IF EXISTS(SELECT 1 FROM public.trade_accounts a WHERE public._instagram_retry_eligible(a)) THEN
  IF NOT EXISTS(SELECT 1 FROM cron.job WHERE jobname='instagram-verification-retries') THEN PERFORM cron.schedule('instagram-verification-retries','0 4 * * *','SELECT public.instagram_retry_dispatch()'); END IF;
  IF TG_TABLE_NAME='integration_tokens' THEN UPDATE public.trade_accounts a SET instagram_retry_after=NULL WHERE public._instagram_retry_eligible(a); END IF;
 END IF;
 PERFORM public.instagram_retry_dispatch();
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.instagram_retry_wake() FROM PUBLIC,anon,authenticated;
DROP TRIGGER instagram_retry_account_wake ON public.trade_accounts;
CREATE TRIGGER instagram_retry_account_wake AFTER INSERT OR UPDATE OF radar_status,status,website_or_ig,instagram_retry_blocked_source ON public.trade_accounts FOR EACH ROW EXECUTE FUNCTION public.instagram_retry_wake();
DO $$ BEGIN PERFORM public.instagram_retry_dispatch(); END $$;