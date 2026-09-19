
CREATE TABLE public.guide_views (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_guide_views_slug_created ON public.guide_views (slug, created_at DESC);
CREATE INDEX idx_guide_views_created ON public.guide_views (created_at DESC);

ALTER TABLE public.guide_views ENABLE ROW LEVEL SECURITY;

-- Anyone authenticated may log their own view
CREATE POLICY "Authenticated users can log guide views"
  ON public.guide_views FOR INSERT
  TO authenticated
  WITH CHECK (user_id IS NULL OR user_id = auth.uid());

-- Only admins may read aggregated analytics
CREATE POLICY "Admins can read guide views"
  ON public.guide_views FOR SELECT
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));
