CREATE OR REPLACE FUNCTION public.currency_for_country(p_country text)
RETURNS text LANGUAGE sql IMMUTABLE SET search_path TO 'public' AS $$
  SELECT CASE upper(trim(coalesce(p_country,'')))
    WHEN 'GB' THEN 'GBP' WHEN 'UNITED KINGDOM' THEN 'GBP' WHEN 'UK' THEN 'GBP'
    WHEN 'US' THEN 'USD' WHEN 'UNITED STATES' THEN 'USD' WHEN 'USA' THEN 'USD'
    WHEN 'CH' THEN 'CHF' WHEN 'SWITZERLAND' THEN 'CHF' WHEN 'LI' THEN 'CHF' WHEN 'LIECHTENSTEIN' THEN 'CHF'
    WHEN 'SG' THEN 'SGD' WHEN 'SINGAPORE' THEN 'SGD'
    WHEN 'HK' THEN 'HKD' WHEN 'HONG KONG' THEN 'HKD'
    WHEN 'AU' THEN 'AUD' WHEN 'AUSTRALIA' THEN 'AUD'
    WHEN 'AE' THEN 'AED' WHEN 'UNITED ARAB EMIRATES' THEN 'AED' WHEN 'SA' THEN 'AED' WHEN 'SAUDI ARABIA' THEN 'AED'
    WHEN 'QA' THEN 'AED' WHEN 'QATAR' THEN 'AED' WHEN 'KW' THEN 'AED' WHEN 'KUWAIT' THEN 'AED'
    WHEN 'BH' THEN 'AED' WHEN 'BAHRAIN' THEN 'AED' WHEN 'OM' THEN 'AED' WHEN 'OMAN' THEN 'AED'
    WHEN 'FR' THEN 'EUR' WHEN 'FRANCE' THEN 'EUR' WHEN 'DE' THEN 'EUR' WHEN 'GERMANY' THEN 'EUR'
    WHEN 'IT' THEN 'EUR' WHEN 'ITALY' THEN 'EUR' WHEN 'ES' THEN 'EUR' WHEN 'SPAIN' THEN 'EUR'
    WHEN 'NL' THEN 'EUR' WHEN 'NETHERLANDS' THEN 'EUR' WHEN 'BE' THEN 'EUR' WHEN 'BELGIUM' THEN 'EUR'
    WHEN 'IE' THEN 'EUR' WHEN 'IRELAND' THEN 'EUR' WHEN 'PT' THEN 'EUR' WHEN 'PORTUGAL' THEN 'EUR'
    WHEN 'AT' THEN 'EUR' WHEN 'AUSTRIA' THEN 'EUR' WHEN 'LU' THEN 'EUR' WHEN 'LUXEMBOURG' THEN 'EUR'
    WHEN 'MC' THEN 'EUR' WHEN 'MONACO' THEN 'EUR' WHEN 'GR' THEN 'EUR' WHEN 'GREECE' THEN 'EUR'
    ELSE NULL END
$$;

CREATE OR REPLACE FUNCTION public.clients_default_currency_from_country()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN
  IF nullif(trim(coalesce(NEW.default_currency,'')),'') IS NULL THEN
    NEW.default_currency := public.currency_for_country(NEW.billing_country);
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS clients_default_currency_from_country ON public.clients;
CREATE TRIGGER clients_default_currency_from_country
BEFORE INSERT OR UPDATE OF billing_country, default_currency ON public.clients
FOR EACH ROW EXECUTE FUNCTION public.clients_default_currency_from_country();

UPDATE public.clients c SET billing_country = l.country
FROM public.trade_accounts ta, public.acquisition_leads l
WHERE ta.id = c.onboarding_account_id AND c.billing_country IS NULL
  AND nullif(trim(l.country),'') IS NOT NULL
  AND split_part(lower(l.business_email),'@',2) = split_part(lower(ta.email),'@',2);

UPDATE public.clients SET default_currency = public.currency_for_country(billing_country)
WHERE nullif(trim(coalesce(default_currency,'')),'') IS NULL AND public.currency_for_country(billing_country) IS NOT NULL;