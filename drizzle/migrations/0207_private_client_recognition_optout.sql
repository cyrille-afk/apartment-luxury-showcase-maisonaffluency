CREATE TABLE public.private_client_recognition_optouts (
  email_hash text PRIMARY KEY,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.private_client_recognition_optouts TO service_role;
ALTER TABLE public.private_client_recognition_optouts ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.private_client_is_opted_out(_email text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.private_client_recognition_optouts
    WHERE email_hash = encode(extensions.digest(lower(trim(_email)), 'sha256'), 'hex'));
$$;

CREATE OR REPLACE FUNCTION public.private_client_forget(_email text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE e text := lower(trim(_email));
BEGIN
  INSERT INTO public.private_client_recognition_optouts(email_hash)
    VALUES (encode(extensions.digest(e, 'sha256'), 'hex')) ON CONFLICT DO NOTHING;
  DELETE FROM public.private_client_challenges WHERE email = e;
  UPDATE public.abandoned_carts SET buyer_profile = NULL WHERE lower(trim(email)) = e AND buyer_profile IS NOT NULL;
END $$;

REVOKE ALL ON FUNCTION public.private_client_is_opted_out(text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.private_client_forget(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.private_client_is_opted_out(text) TO service_role;
GRANT EXECUTE ON FUNCTION public.private_client_forget(text) TO service_role;