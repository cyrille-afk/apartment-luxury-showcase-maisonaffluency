DROP TRIGGER IF EXISTS queue_trade_account_alert ON public.trade_accounts;
DROP TRIGGER IF EXISTS queue_trade_application_alert ON public.trade_applications;
CREATE OR REPLACE FUNCTION public.queue_registration_alert() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ BEGIN
IF TG_TABLE_NAME <> 'profiles' THEN RETURN NEW; END IF;
IF NOT EXISTS (SELECT 1 FROM auth.users u WHERE u.id=NEW.id AND u.raw_user_meta_data->>'registration_origin'='public_account') THEN RETURN NEW; END IF;
INSERT INTO public.registration_alert_events(event_type,source_id,source_table) VALUES('new_account',NEW.id,'profiles') ON CONFLICT DO NOTHING;
PERFORM public.dispatch_registration_alerts();
RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.queue_registration_alert() FROM PUBLIC,anon,authenticated;
COMMENT ON FUNCTION public.queue_registration_alert() IS 'Immediate public account signup alerts only; no recurring polling. Trade application notifications retain their original send path.';