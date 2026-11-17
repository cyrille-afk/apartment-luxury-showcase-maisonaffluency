REVOKE ALL ON public.catalog_items FROM anon;
REVOKE TRUNCATE, REFERENCES, TRIGGER ON public.catalog_items FROM authenticated;