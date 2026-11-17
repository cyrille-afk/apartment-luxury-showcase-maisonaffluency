REVOKE ALL ON public.developer_projects, public.residence_layouts, public.furniture_packages FROM anon;
REVOKE ALL ON public.furniture_packages FROM authenticated;
GRANT SELECT ON public.furniture_packages TO authenticated;
REVOKE ALL ON FUNCTION public.validate_viewing_room_package() FROM PUBLIC, anon, authenticated;