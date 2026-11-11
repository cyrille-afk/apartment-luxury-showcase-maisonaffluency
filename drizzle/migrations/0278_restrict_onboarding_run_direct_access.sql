REVOKE ALL ON public.onboarding_tour_runs FROM anon,authenticated;
GRANT SELECT ON public.onboarding_tour_runs TO authenticated;
GRANT ALL ON public.onboarding_tour_runs TO service_role;