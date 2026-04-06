ALTER VIEW public.designer_curator_picks_public SET (security_invoker = true);
GRANT SELECT ON public.designer_curator_picks_public TO anon, authenticated;