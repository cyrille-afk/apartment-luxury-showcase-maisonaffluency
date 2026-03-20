
-- Editorial pipeline for planned journal articles
CREATE TYPE public.pipeline_status AS ENUM ('idea', 'planning', 'drafting', 'review', 'ready', 'published', 'killed');

CREATE TABLE public.journal_pipeline (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  category public.journal_category NOT NULL DEFAULT 'design_trend',
  target_date date,
  status public.pipeline_status NOT NULL DEFAULT 'idea',
  designer_or_brand text DEFAULT '',
  angle text DEFAULT '',
  seo_keywords text DEFAULT '',
  notes text DEFAULT '',
  author text NOT NULL DEFAULT 'Maison Affluency',
  article_id uuid REFERENCES public.journal_articles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.journal_pipeline ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage pipeline"
  ON public.journal_pipeline FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
