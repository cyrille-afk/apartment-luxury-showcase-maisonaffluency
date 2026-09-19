
CREATE TABLE public.section_heroes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  section_key text NOT NULL UNIQUE,
  image_url text NOT NULL,
  gravity text NOT NULL DEFAULT 'auto',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.section_heroes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view section heroes"
  ON public.section_heroes FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins can manage section heroes"
  ON public.section_heroes FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
