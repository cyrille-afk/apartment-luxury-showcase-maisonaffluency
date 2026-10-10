CREATE OR REPLACE FUNCTION public.tier_discount_pct(_tier trade_tier)
RETURNS numeric
LANGUAGE sql
STABLE
SET search_path TO 'public'
AS $function$
  SELECT COALESCE(
    (SELECT discount_pct FROM public.trade_tier_config WHERE tier = _tier),
    (SELECT discount_pct FROM public.trade_tier_config WHERE tier = 'silver'),
    0
  );
$function$;