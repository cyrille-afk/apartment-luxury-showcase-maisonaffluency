REVOKE ALL ON FUNCTION public.is_approved_trade_user(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_approved_trade_user(uuid) TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.protect_trade_application_privileged_fields() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.protect_trade_application_privileged_fields() TO service_role;