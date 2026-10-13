CREATE OR REPLACE FUNCTION public.country_for_phone(p_phone text)
RETURNS text LANGUAGE sql IMMUTABLE SET search_path TO 'public' AS $$
  WITH d AS (SELECT regexp_replace(coalesce(p_phone,''), '[^0-9+]', '', 'g') AS n),
  m(prefix, country) AS (VALUES
    ('+971','United Arab Emirates'),('+966','Saudi Arabia'),('+974','Qatar'),('+965','Kuwait'),
    ('+973','Bahrain'),('+968','Oman'),('+852','Hong Kong'),('+353','Ireland'),('+351','Portugal'),
    ('+352','Luxembourg'),('+377','Monaco'),('+423','Liechtenstein'),('+65','Singapore'),
    ('+61','Australia'),('+66','Thailand'),('+44','United Kingdom'),('+33','France'),('+49','Germany'),
    ('+39','Italy'),('+34','Spain'),('+31','Netherlands'),('+32','Belgium'),('+43','Austria'),
    ('+30','Greece'),('+41','Switzerland'),('+1','United States'))
  SELECT m.country FROM d, m WHERE d.n LIKE m.prefix || '%' ORDER BY length(m.prefix) DESC LIMIT 1
$$;

CREATE OR REPLACE FUNCTION public.clients_default_currency_from_country()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF nullif(trim(coalesce(NEW.billing_country,'')),'') IS NULL AND NEW.onboarding_account_id IS NOT NULL THEN
    SELECT public.country_for_phone(ta.phone_number) INTO NEW.billing_country
    FROM public.trade_accounts ta WHERE ta.id = NEW.onboarding_account_id;
  END IF;
  IF nullif(trim(coalesce(NEW.default_currency,'')),'') IS NULL THEN
    NEW.default_currency := public.currency_for_country(NEW.billing_country);
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS clients_default_currency_from_country ON public.clients;
CREATE TRIGGER clients_default_currency_from_country
BEFORE INSERT OR UPDATE OF billing_country, default_currency, onboarding_account_id ON public.clients
FOR EACH ROW EXECUTE FUNCTION public.clients_default_currency_from_country();