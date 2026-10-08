DROP FUNCTION IF EXISTS public.get_shared_ai_layout(text);
CREATE FUNCTION public.get_shared_ai_layout(_token text)
 RETURNS TABLE(title text, scene jsonb, products jsonb, updated_at timestamptz, camera_paths jsonb)
 LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT l.title, l.scene, l.products, l.updated_at,
    COALESCE((SELECT jsonb_agg(jsonb_build_object('id', p->>'id', 'name', p->>'name', 'nodes', p->'nodes'))
              FROM jsonb_array_elements(COALESCE(to_jsonb(l.camera_paths), '[]'::jsonb)) p), '[]'::jsonb)
  FROM public.ai_curated_layouts l
  WHERE l.share_token = _token AND l.is_shared AND length(_token) >= 32 LIMIT 1
$$;
GRANT EXECUTE ON FUNCTION public.get_shared_ai_layout(text) TO anon, authenticated;