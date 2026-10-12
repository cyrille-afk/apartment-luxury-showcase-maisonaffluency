ALTER TABLE public.profiles ADD COLUMN ip_detected_country text, ADD COLUMN ip_detected_currency text, ADD COLUMN ip_detected_at timestamptz;
ALTER TABLE public.clients ADD COLUMN ip_detected_country text, ADD COLUMN ip_detected_currency text, ADD COLUMN ip_detected_at timestamptz;
CREATE FUNCTION public.guard_ip_detection_fields() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
 IF auth.role() IS DISTINCT FROM 'service_role' THEN
  IF TG_OP = 'INSERT' THEN NEW.ip_detected_country := NULL; NEW.ip_detected_currency := NULL; NEW.ip_detected_at := NULL;
  ELSE NEW.ip_detected_country := OLD.ip_detected_country; NEW.ip_detected_currency := OLD.ip_detected_currency; NEW.ip_detected_at := OLD.ip_detected_at;
  END IF;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER guard_profile_ip_detection BEFORE INSERT OR UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.guard_ip_detection_fields();
CREATE TRIGGER guard_client_ip_detection BEFORE INSERT OR UPDATE ON public.clients FOR EACH ROW EXECUTE FUNCTION public.guard_ip_detection_fields();
CREATE FUNCTION public.sync_profile_ip_detection() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
 UPDATE public.clients c SET ip_detected_country = NEW.ip_detected_country, ip_detected_currency = NEW.ip_detected_currency, ip_detected_at = NEW.ip_detected_at
 FROM public.trade_accounts a WHERE c.onboarding_account_id = a.id AND a.user_id = NEW.id;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.sync_profile_ip_detection() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.sync_profile_ip_detection() TO service_role;
CREATE TRIGGER sync_profile_ip_detection AFTER UPDATE OF ip_detected_country, ip_detected_currency, ip_detected_at ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.sync_profile_ip_detection();
CREATE FUNCTION public.inherit_client_ip_detection() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
 IF NEW.onboarding_account_id IS NOT NULL THEN
  SELECT p.ip_detected_country, p.ip_detected_currency, p.ip_detected_at INTO NEW.ip_detected_country, NEW.ip_detected_currency, NEW.ip_detected_at FROM public.profiles p JOIN public.trade_accounts a ON a.user_id=p.id WHERE a.id=NEW.onboarding_account_id;
 END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.inherit_client_ip_detection() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.inherit_client_ip_detection() TO service_role;
CREATE TRIGGER inherit_client_ip_detection BEFORE INSERT OR UPDATE OF onboarding_account_id ON public.clients FOR EACH ROW EXECUTE FUNCTION public.inherit_client_ip_detection();