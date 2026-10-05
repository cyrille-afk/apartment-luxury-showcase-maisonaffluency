CREATE OR REPLACE FUNCTION public.published_maker_count()
RETURNS integer LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT count(DISTINCT d.id)::int FROM public.designers d
  JOIN public.designer_curator_picks p ON p.designer_id = d.id
  WHERE d.is_published AND d.slug IS NOT NULL
$$;
GRANT EXECUTE ON FUNCTION public.published_maker_count() TO anon, authenticated;