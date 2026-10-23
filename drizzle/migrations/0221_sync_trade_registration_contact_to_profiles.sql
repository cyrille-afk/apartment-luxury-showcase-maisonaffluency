CREATE OR REPLACE FUNCTION public.fill_trade_registration_profile_contacts()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE a public.trade_accounts%ROWTYPE; l public.trade_applications%ROWTYPE; s public.trade_program_signups%ROWTYPE; parts text[];
BEGIN
 SELECT * INTO a FROM public.trade_accounts WHERE user_id=NEW.id AND status='approved' ORDER BY approved_at DESC NULLS LAST, created_at DESC, id LIMIT 1;
 IF a.id IS NOT NULL THEN
  SELECT * INTO l FROM public.trade_applications WHERE id=a.legacy_application_id AND user_id=NEW.id;
  SELECT * INTO s FROM public.trade_program_signups WHERE id=a.signup_id;
 ELSE
  SELECT * INTO l FROM public.trade_applications WHERE user_id=NEW.id AND status='approved' ORDER BY created_at DESC, id LIMIT 1;
 END IF;
 parts := regexp_split_to_array(nullif(btrim(a.contact_name),''), '\s+');
 -- Fill missing contact details only; never grant access or replace account edits.
 IF nullif(btrim(NEW.first_name),'') IS NULL THEN NEW.first_name := coalesce(parts[1], NEW.first_name); END IF;
 IF nullif(btrim(NEW.last_name),'') IS NULL AND nullif(btrim(NEW.first_name),'') = parts[1] THEN
  NEW.last_name := coalesce(nullif(array_to_string(parts[2:array_length(parts,1)],' '),''), NEW.last_name);
 END IF;
 IF nullif(btrim(NEW.company),'') IS NULL THEN NEW.company := coalesce(nullif(btrim(a.studio_name),''),nullif(btrim(l.company_name),''),NEW.company); END IF;
 IF nullif(btrim(NEW.phone),'') IS NULL THEN NEW.phone := coalesce(nullif(btrim(a.phone_number),''),nullif(btrim(s.phone_number),''),NEW.phone); END IF;
 IF nullif(btrim(NEW.country),'') IS NULL THEN NEW.country := coalesce(nullif(btrim(a.country),''),nullif(btrim(l.country),''),NEW.country); END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.fill_trade_registration_profile_contacts() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER profiles_fill_trade_registration_contacts BEFORE INSERT OR UPDATE OF first_name,last_name,company,phone,country ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.fill_trade_registration_profile_contacts();

CREATE OR REPLACE FUNCTION public.refresh_trade_registration_profile_contacts()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
 IF NEW.user_id IS NOT NULL AND NEW.status='approved' THEN
  UPDATE public.profiles SET company=company WHERE id=NEW.user_id;
 END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.refresh_trade_registration_profile_contacts() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER trade_accounts_fill_profile_contacts AFTER INSERT OR UPDATE OF status,user_id,studio_name,contact_name,phone_number,country,signup_id,legacy_application_id ON public.trade_accounts FOR EACH ROW EXECUTE FUNCTION public.refresh_trade_registration_profile_contacts();
CREATE TRIGGER trade_applications_fill_profile_contacts AFTER INSERT OR UPDATE OF status,user_id,company_name,country ON public.trade_applications FOR EACH ROW EXECUTE FUNCTION public.refresh_trade_registration_profile_contacts();