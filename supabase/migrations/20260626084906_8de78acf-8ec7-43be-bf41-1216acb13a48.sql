CREATE OR REPLACE FUNCTION public.get_designer_for_upload(_slug text)
RETURNS TABLE(id uuid, name text, slug text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT d.id, d.name, d.slug
  FROM public.designers d
  WHERE d.slug = _slug
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.get_designer_for_upload(text) TO anon, authenticated;