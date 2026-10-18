REVOKE ALL ON public.curated_pairing_history FROM anon;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON public.curated_pairing_history FROM authenticated;
GRANT SELECT ON public.curated_pairing_history TO authenticated;
GRANT ALL ON public.curated_pairing_history TO service_role;