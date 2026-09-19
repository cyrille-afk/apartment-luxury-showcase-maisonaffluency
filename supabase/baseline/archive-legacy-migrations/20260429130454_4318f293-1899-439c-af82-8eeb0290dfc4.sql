CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TABLE public.featured_studios (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  slug text NOT NULL UNIQUE,
  name text NOT NULL,
  tagline text DEFAULT '',
  bio text DEFAULT '',
  founded_year smallint,
  team_size text DEFAULT '',
  location text DEFAULT '',
  country text DEFAULT '',
  website_url text DEFAULT '',
  contact_email text DEFAULT '',
  instagram_handle text DEFAULT '',
  logo_url text DEFAULT '',
  hero_image_url text DEFAULT '',
  gallery_images text[] DEFAULT '{}'::text[],
  disciplines text[] NOT NULL DEFAULT '{}'::text[],
  project_types text[] NOT NULL DEFAULT '{}'::text[],
  notable_projects text DEFAULT '',
  is_featured boolean NOT NULL DEFAULT false,
  is_published boolean NOT NULL DEFAULT false,
  sort_order smallint NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX idx_featured_studios_published ON public.featured_studios(is_published, sort_order);
CREATE INDEX idx_featured_studios_disciplines ON public.featured_studios USING GIN(disciplines);
CREATE INDEX idx_featured_studios_project_types ON public.featured_studios USING GIN(project_types);

ALTER TABLE public.featured_studios ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view published studios"
ON public.featured_studios FOR SELECT
TO anon, authenticated
USING (is_published = true);

CREATE POLICY "Admins can manage featured studios"
ON public.featured_studios FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER update_featured_studios_updated_at
BEFORE UPDATE ON public.featured_studios
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();