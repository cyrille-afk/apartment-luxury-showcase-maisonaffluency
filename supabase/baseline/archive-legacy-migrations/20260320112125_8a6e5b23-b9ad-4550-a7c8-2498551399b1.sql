
-- Competitor galleries table
CREATE TABLE public.competitor_galleries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  website_url text NOT NULL,
  location text NOT NULL DEFAULT '',
  region text NOT NULL DEFAULT 'asia',
  logo_url text,
  description text,
  last_scraped_at timestamptz,
  scrape_status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.competitor_galleries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage competitor galleries"
  ON public.competitor_galleries FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Competitor designers (scraped roster)
CREATE TABLE public.competitor_designers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  gallery_id uuid NOT NULL REFERENCES public.competitor_galleries(id) ON DELETE CASCADE,
  designer_name text NOT NULL,
  is_overlap boolean NOT NULL DEFAULT false,
  profile_url text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.competitor_designers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage competitor designers"
  ON public.competitor_designers FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Auction benchmarks
CREATE TABLE public.auction_benchmarks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  auction_house text NOT NULL,
  designer_name text NOT NULL,
  piece_title text NOT NULL,
  sale_date text,
  estimate_low_usd integer,
  estimate_high_usd integer,
  sold_price_usd integer,
  lot_url text,
  currency text NOT NULL DEFAULT 'USD',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.auction_benchmarks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage auction benchmarks"
  ON public.auction_benchmarks FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Seed the 4 competitor galleries
INSERT INTO public.competitor_galleries (name, website_url, location, region, description) VALUES
  ('Gallery ALL', 'https://www.galleryall.com', 'Taipei, Taiwan', 'asia', 'Contemporary collectible design gallery in Asia'),
  ('Carwan Gallery', 'https://www.carwangallery.com', 'Beirut / Dubai', 'middle_east', 'Middle East leading collectible design gallery'),
  ('Objective Gallery', 'https://www.objectivegallery.com', 'Shanghai, China', 'asia', 'Contemporary design gallery in mainland China'),
  ('Friedman Benda', 'https://www.friedmanbenda.com', 'New York, USA', 'international', 'Leading international collectible design gallery');
