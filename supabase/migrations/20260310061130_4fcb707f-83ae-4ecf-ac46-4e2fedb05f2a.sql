
CREATE TABLE public.gallery_hotspots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  image_identifier text NOT NULL,
  x_percent numeric NOT NULL,
  y_percent numeric NOT NULL,
  product_name text NOT NULL,
  designer_name text,
  product_image_url text,
  link_url text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.gallery_hotspots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read gallery hotspots"
  ON public.gallery_hotspots
  FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE INDEX idx_gallery_hotspots_image ON public.gallery_hotspots(image_identifier);
