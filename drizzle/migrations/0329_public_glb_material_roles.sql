CREATE OR REPLACE FUNCTION public.get_glb_material_roles(_glb_url text)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT v.material_roles FROM public.trade_product_glb_variants v
  WHERE v.glb_url = _glb_url AND v.material_roles IS NOT NULL AND v.material_roles <> '{}'::jsonb
  ORDER BY v.is_default DESC NULLS LAST LIMIT 1
$$;
REVOKE ALL ON FUNCTION public.get_glb_material_roles(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_glb_material_roles(text) TO anon, authenticated, service_role;