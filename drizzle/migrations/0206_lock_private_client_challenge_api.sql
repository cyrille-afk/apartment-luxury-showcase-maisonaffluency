REVOKE ALL ON public.private_client_challenges FROM anon, authenticated;
GRANT ALL ON public.private_client_challenges TO service_role;