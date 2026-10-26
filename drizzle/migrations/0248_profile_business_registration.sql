ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS business_reg_number text, ADD COLUMN IF NOT EXISTS tax_vat_id text;

CREATE OR REPLACE FUNCTION public.refresh_trade_registration_profile_contacts()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE regno text; vat text;
BEGIN
 IF NEW.user_id IS NOT NULL AND NEW.status='approved' THEN
  SELECT coalesce(nullif(trim(NEW.business_reg_number),''),nullif(trim(l.corporate_reg_number),''),nullif(trim(s.business_reg_number),'')),
         coalesce(nullif(trim(NEW.tax_vat_id),''),nullif(trim(l.tax_vat_id),''))
    INTO regno, vat
    FROM (SELECT 1) x
    LEFT JOIN public.trade_applications l ON l.id=NEW.legacy_application_id
    LEFT JOIN public.trade_program_signups s ON s.id=NEW.signup_id;
  UPDATE public.profiles SET company=company,
    business_reg_number=coalesce(nullif(trim(business_reg_number),''),regno),
    tax_vat_id=coalesce(nullif(trim(tax_vat_id),''),vat)
  WHERE id=NEW.user_id;
 END IF;
 RETURN NEW;
END $function$;

DROP TRIGGER IF EXISTS trade_accounts_fill_profile_contacts ON public.trade_accounts;
CREATE TRIGGER trade_accounts_fill_profile_contacts AFTER INSERT OR UPDATE OF status, user_id, studio_name, contact_name, phone_number, country, signup_id, legacy_application_id, business_reg_number, tax_vat_id ON public.trade_accounts FOR EACH ROW EXECUTE FUNCTION public.refresh_trade_registration_profile_contacts();

UPDATE public.profiles p SET
  business_reg_number=coalesce(nullif(trim(a.business_reg_number),''),nullif(trim(l.corporate_reg_number),''),nullif(trim(s.business_reg_number),'')),
  tax_vat_id=coalesce(nullif(trim(a.tax_vat_id),''),nullif(trim(l.tax_vat_id),''))
FROM public.trade_accounts a
LEFT JOIN public.trade_applications l ON l.id=a.legacy_application_id
LEFT JOIN public.trade_program_signups s ON s.id=a.signup_id
WHERE a.user_id=p.id AND a.status='approved' AND p.business_reg_number IS NULL AND p.tax_vat_id IS NULL;