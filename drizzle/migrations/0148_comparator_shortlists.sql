CREATE TABLE public.comparator_shortlists (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  name text NOT NULL DEFAULT 'Shortlist',
  items jsonb NOT NULL DEFAULT '[]'::jsonb,
  share_token text NOT NULL UNIQUE DEFAULT encode(extensions.gen_random_bytes(16), 'hex'),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.comparator_shortlists TO authenticated;
GRANT ALL ON public.comparator_shortlists TO service_role;
ALTER TABLE public.comparator_shortlists ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owners manage shortlists" ON public.comparator_shortlists
  FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.get_shared_shortlist(p_token text)
RETURNS TABLE(name text, items jsonb, created_at timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT s.name, s.items, s.created_at FROM public.comparator_shortlists s
  WHERE s.share_token = p_token AND length(p_token) >= 32;
$$;
REVOKE ALL ON FUNCTION public.get_shared_shortlist(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_shared_shortlist(text) TO anon, authenticated;