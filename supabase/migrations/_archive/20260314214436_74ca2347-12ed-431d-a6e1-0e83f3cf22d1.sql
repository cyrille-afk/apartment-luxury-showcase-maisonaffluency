
CREATE TABLE public.brand_thumbnails (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_name text NOT NULL UNIQUE,
  thumbnail_url text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.brand_thumbnails ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage brand thumbnails"
  ON public.brand_thumbnails FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Authenticated users can view brand thumbnails"
  ON public.brand_thumbnails FOR SELECT TO authenticated
  USING (true);
