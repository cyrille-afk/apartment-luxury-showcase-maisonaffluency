REVOKE ALL ON public.admin_price_save_attempts FROM anon;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON public.admin_price_save_attempts FROM authenticated;
GRANT SELECT ON public.admin_price_save_attempts TO authenticated;
GRANT ALL ON public.admin_price_save_attempts TO service_role;