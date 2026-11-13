REVOKE ALL ON public.project_specification_targets FROM anon;
REVOKE ALL ON public.project_specification_targets FROM PUBLIC;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.project_specification_targets TO authenticated;
GRANT ALL ON public.project_specification_targets TO service_role;