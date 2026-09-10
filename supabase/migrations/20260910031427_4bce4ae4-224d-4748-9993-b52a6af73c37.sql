GRANT EXECUTE ON FUNCTION public.can_view_studio(uuid, uuid) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.can_edit_studio(uuid, uuid) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.has_studio_role(uuid, uuid, public.studio_role) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_user_studio_ids(uuid) TO anon, authenticated, service_role;