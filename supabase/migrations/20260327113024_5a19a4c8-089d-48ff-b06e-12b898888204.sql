
CREATE TABLE public.designer_heritage_slides (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  designer_id uuid NOT NULL REFERENCES public.designers(id) ON DELETE CASCADE,
  image_url text NOT NULL,
  caption text,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.designer_heritage_slides ENABLE ROW LEVEL SECURITY;

-- Public read access
CREATE POLICY "Anyone can view heritage slides"
  ON public.designer_heritage_slides FOR SELECT
  USING (true);

-- Admin insert/update/delete
CREATE POLICY "Admins can manage heritage slides"
  ON public.designer_heritage_slides FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
