
CREATE TABLE public.reference_styles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mode text NOT NULL UNIQUE,
  image_url text NOT NULL,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.reference_styles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage reference styles"
  ON public.reference_styles FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Authenticated users can view reference styles"
  ON public.reference_styles FOR SELECT
  TO authenticated
  USING (true);
