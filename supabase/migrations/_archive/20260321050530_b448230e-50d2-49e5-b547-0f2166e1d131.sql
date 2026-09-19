
-- Designers table
CREATE TABLE public.designers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  name text NOT NULL,
  founder text,
  display_name text,
  specialty text NOT NULL DEFAULT '',
  biography text NOT NULL DEFAULT '',
  notable_works text NOT NULL DEFAULT '',
  philosophy text NOT NULL DEFAULT '',
  image_url text NOT NULL DEFAULT '',
  logo_url text,
  source text NOT NULL DEFAULT 'featured',
  links jsonb DEFAULT '[]'::jsonb,
  is_published boolean NOT NULL DEFAULT false,
  sort_order smallint NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.designers ENABLE ROW LEVEL SECURITY;

-- Anyone can view published designers (public page)
CREATE POLICY "Anyone can view published designers"
  ON public.designers FOR SELECT
  TO anon, authenticated
  USING (is_published = true);

-- Admins can manage all designers
CREATE POLICY "Admins can manage designers"
  ON public.designers FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Trade users can view all designers (even unpublished, for trade directory)
CREATE POLICY "Trade users can view all designers"
  ON public.designers FOR SELECT
  TO authenticated
  USING (has_role(auth.uid(), 'trade_user'::app_role));

-- Curator Picks table
CREATE TABLE public.designer_curator_picks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  designer_id uuid NOT NULL REFERENCES public.designers(id) ON DELETE CASCADE,
  image_url text NOT NULL DEFAULT '',
  hover_image_url text,
  title text NOT NULL DEFAULT '',
  subtitle text,
  category text,
  subcategory text,
  tags text[],
  materials text,
  dimensions text,
  description text,
  edition text,
  photo_credit text,
  pdf_url text,
  pdf_filename text,
  pdf_urls jsonb,
  sort_order smallint NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.designer_curator_picks ENABLE ROW LEVEL SECURITY;

-- Anyone can view picks for published designers
CREATE POLICY "Anyone can view published designer picks"
  ON public.designer_curator_picks FOR SELECT
  TO anon, authenticated
  USING (EXISTS (
    SELECT 1 FROM public.designers
    WHERE designers.id = designer_curator_picks.designer_id
    AND designers.is_published = true
  ));

-- Admins can manage all picks
CREATE POLICY "Admins can manage designer picks"
  ON public.designer_curator_picks FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Trade users can view all picks
CREATE POLICY "Trade users can view all designer picks"
  ON public.designer_curator_picks FOR SELECT
  TO authenticated
  USING (has_role(auth.uid(), 'trade_user'::app_role));
