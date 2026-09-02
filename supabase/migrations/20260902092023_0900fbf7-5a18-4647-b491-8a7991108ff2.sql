-- Ensure authenticated role can always execute the project RLS helpers
-- (20260512124136 bulk-revoked EXECUTE from PUBLIC; live DB was patched
-- out-of-band — this makes the grants durable across rebuilds)
GRANT EXECUTE ON FUNCTION public.can_view_project(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_edit_project(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.effective_project_role(uuid, uuid) TO authenticated;

-- Restore column-level protection on profiles: the out-of-band fix for
-- "permission denied for table profiles" re-granted table-level SELECT,
-- which silently re-exposed the phone column (meant to be readable only via
-- public.get_my_phone()). Column-level grants for all non-phone columns are
-- already in place; verified no client code selects `phone` or `*`.
REVOKE SELECT ON public.profiles FROM authenticated;