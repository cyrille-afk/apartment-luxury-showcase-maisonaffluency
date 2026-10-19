CREATE OR REPLACE FUNCTION public.private_client_optin(_email text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.private_client_recognition_optouts
  WHERE email_hash = encode(extensions.digest(lower(trim(_email)), 'sha256'), 'hex');
END;
$$;
REVOKE ALL ON FUNCTION public.private_client_optin(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.private_client_optin(text) TO service_role;