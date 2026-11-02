REVOKE ALL ON public.directory_activity_events FROM anon;
REVOKE ALL ON FUNCTION public.admin_directory_activity(integer,text,text) FROM anon;
REVOKE ALL ON public.directory_activity_events FROM authenticated;
GRANT SELECT ON public.directory_activity_events TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_directory_activity(integer,text,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.record_directory_activity(uuid,text,text,text,uuid,text,text,text) TO anon,authenticated,service_role;