-- Harden RLS on collector_applications
GRANT SELECT, INSERT ON public.collector_applications TO authenticated;
GRANT UPDATE ON public.collector_applications TO authenticated;
GRANT ALL ON public.collector_applications TO service_role;
-- anon has no access

ALTER TABLE public.collector_applications FORCE ROW LEVEL SECURITY;