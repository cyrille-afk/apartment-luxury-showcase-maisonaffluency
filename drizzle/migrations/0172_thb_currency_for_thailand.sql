CREATE OR REPLACE FUNCTION public.currency_for_country(p_country text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE lower(trim(coalesce(p_country, '')))
    WHEN 'united kingdom' THEN 'GBP' WHEN 'uk' THEN 'GBP' WHEN 'england' THEN 'GBP' WHEN 'scotland' THEN 'GBP' WHEN 'wales' THEN 'GBP'
    WHEN 'united states' THEN 'USD' WHEN 'usa' THEN 'USD' WHEN 'u.s.' THEN 'USD' WHEN 'u.s.a.' THEN 'USD'
    WHEN 'hong kong' THEN 'HKD'
    WHEN 'united arab emirates' THEN 'AED' WHEN 'uae' THEN 'AED'
    WHEN 'saudi arabia' THEN 'AED' WHEN 'qatar' THEN 'AED' WHEN 'kuwait' THEN 'AED' WHEN 'bahrain' THEN 'AED' WHEN 'oman' THEN 'AED'
    WHEN 'switzerland' THEN 'CHF' WHEN 'liechtenstein' THEN 'CHF'
    WHEN 'australia' THEN 'AUD'
    WHEN 'singapore' THEN 'SGD'
    WHEN 'thailand' THEN 'THB'
    WHEN 'france' THEN 'EUR' WHEN 'germany' THEN 'EUR' WHEN 'italy' THEN 'EUR' WHEN 'spain' THEN 'EUR'
    WHEN 'netherlands' THEN 'EUR' WHEN 'belgium' THEN 'EUR' WHEN 'ireland' THEN 'EUR' WHEN 'portugal' THEN 'EUR'
    WHEN 'austria' THEN 'EUR' WHEN 'greece' THEN 'EUR' WHEN 'finland' THEN 'EUR' WHEN 'luxembourg' THEN 'EUR'
    WHEN 'monaco' THEN 'EUR' WHEN 'cyprus' THEN 'EUR' WHEN 'estonia' THEN 'EUR' WHEN 'latvia' THEN 'EUR'
    WHEN 'lithuania' THEN 'EUR' WHEN 'malta' THEN 'EUR' WHEN 'slovakia' THEN 'EUR' WHEN 'slovenia' THEN 'EUR'
    WHEN 'croatia' THEN 'EUR' WHEN 'andorra' THEN 'EUR' WHEN 'san marino' THEN 'EUR' WHEN 'vatican city' THEN 'EUR'
    ELSE NULL
  END
$$;