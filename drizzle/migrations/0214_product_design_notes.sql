CREATE TABLE public.product_design_notes (
  pick_id uuid PRIMARY KEY REFERENCES public.designer_curator_picks(id) ON DELETE CASCADE,
  form text,
  function text,
  texture text,
  colour text,
  sources text,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.product_design_notes TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.product_design_notes TO authenticated;
GRANT ALL ON public.product_design_notes TO service_role;
ALTER TABLE public.product_design_notes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Design notes are readable" ON public.product_design_notes FOR SELECT USING (true);
CREATE POLICY "Admins manage design notes" ON public.product_design_notes FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));