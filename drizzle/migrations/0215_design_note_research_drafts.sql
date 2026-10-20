CREATE TABLE public.design_note_research_drafts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pick_id uuid NOT NULL UNIQUE,
  product_title text NOT NULL DEFAULT '',
  designer_name text NOT NULL DEFAULT '',
  form text, function text, texture text, colour text,
  sources jsonb NOT NULL DEFAULT '[]'::jsonb,
  review_status text NOT NULL DEFAULT 'draft',
  reviewer_notes text,
  updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.design_note_research_drafts TO authenticated;
GRANT ALL ON public.design_note_research_drafts TO service_role;
ALTER TABLE public.design_note_research_drafts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage research drafts" ON public.design_note_research_drafts
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE OR REPLACE FUNCTION public.design_note_research_validate() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.review_status NOT IN ('draft','needs_review','approved','rejected','published') THEN
    RAISE EXCEPTION 'invalid review_status %', NEW.review_status;
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END $$;
CREATE TRIGGER design_note_research_validate BEFORE INSERT OR UPDATE ON public.design_note_research_drafts
  FOR EACH ROW EXECUTE FUNCTION public.design_note_research_validate();