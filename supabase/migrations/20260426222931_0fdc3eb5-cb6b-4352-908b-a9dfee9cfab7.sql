CREATE TABLE public.trade_custom_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  product_id uuid REFERENCES public.trade_products(id) ON DELETE SET NULL,
  product_name text NOT NULL,
  brand_name text,
  project_id uuid REFERENCES public.projects(id) ON DELETE SET NULL,
  request_type text NOT NULL DEFAULT 'customisation',
  dimension_changes text,
  finish_notes text,
  com_col_fabric text,
  com_yardage_meters numeric,
  quantity integer NOT NULL DEFAULT 1,
  target_lead_weeks integer,
  budget_notes text,
  notes text,
  status text NOT NULL DEFAULT 'new',
  admin_notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.trade_custom_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view their own custom requests"
  ON public.trade_custom_requests FOR SELECT
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users create their own custom requests"
  ON public.trade_custom_requests FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users update their own custom requests"
  ON public.trade_custom_requests FOR UPDATE
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users delete their own custom requests"
  ON public.trade_custom_requests FOR DELETE
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER trade_custom_requests_set_updated_at
  BEFORE UPDATE ON public.trade_custom_requests
  FOR EACH ROW EXECUTE FUNCTION public.tms_set_updated_at();

CREATE INDEX idx_trade_custom_requests_user ON public.trade_custom_requests(user_id, created_at DESC);

CREATE TABLE public.trade_fair_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  category text NOT NULL DEFAULT 'fair',
  city text,
  country text,
  venue text,
  starts_on date NOT NULL,
  ends_on date NOT NULL,
  website_url text,
  description text,
  brands_exhibiting text[],
  cover_image_url text,
  is_published boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.trade_fair_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view published trade fair events"
  ON public.trade_fair_events FOR SELECT
  USING (is_published = true OR public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins manage trade fair events"
  ON public.trade_fair_events FOR ALL
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER trade_fair_events_set_updated_at
  BEFORE UPDATE ON public.trade_fair_events
  FOR EACH ROW EXECUTE FUNCTION public.tms_set_updated_at();

CREATE INDEX idx_trade_fair_events_dates ON public.trade_fair_events(starts_on);

INSERT INTO public.trade_fair_events (name, slug, category, city, country, venue, starts_on, ends_on, website_url, description) VALUES
  ('Salone del Mobile 2026', 'salone-del-mobile-2026', 'fair', 'Milan', 'Italy', 'Fiera Milano, Rho', '2026-04-21', '2026-04-26', 'https://www.salonemilano.it', 'The world''s leading furniture and design trade fair, gathering the most prestigious ateliers and editors.'),
  ('Maison&Objet Paris January 2026', 'maison-objet-paris-jan-2026', 'fair', 'Paris', 'France', 'Paris Nord Villepinte', '2026-01-15', '2026-01-19', 'https://www.maison-objet.com', 'The premier international trade fair for home decor, interior design and lifestyle industries.'),
  ('Maison&Objet Paris September 2026', 'maison-objet-paris-sep-2026', 'fair', 'Paris', 'France', 'Paris Nord Villepinte', '2026-09-04', '2026-09-08', 'https://www.maison-objet.com', 'Autumn edition of Maison&Objet, focused on new collections and emerging talents.'),
  ('PAD Paris 2026', 'pad-paris-2026', 'fair', 'Paris', 'France', 'Jardin des Tuileries', '2026-04-01', '2026-04-05', 'https://www.pad-fairs.com', 'Pavilion of Art & Design — modern and contemporary collectible design and art.'),
  ('PAD London 2026', 'pad-london-2026', 'fair', 'London', 'United Kingdom', 'Berkeley Square, Mayfair', '2026-10-07', '2026-10-11', 'https://www.pad-fairs.com', 'PAD London — the leading European fair for 20th and 21st century design.'),
  ('Design Miami 2026', 'design-miami-2026', 'fair', 'Miami Beach', 'United States', 'Miami Beach Convention Center', '2026-12-01', '2026-12-06', 'https://www.designmiami.com', 'The global forum for collectible design — historical and contemporary furniture, lighting and objets d''art.'),
  ('Design Miami Paris 2026', 'design-miami-paris-2026', 'fair', 'Paris', 'France', 'Hôtel de Maisons', '2026-10-21', '2026-10-25', 'https://www.designmiami.com', 'Paris edition of Design Miami, hosted in a historic hôtel particulier.'),
  ('Matter & Shape Paris 2026', 'matter-shape-paris-2026', 'fair', 'Paris', 'France', 'Tuileries Garden', '2026-03-06', '2026-03-09', 'https://matterandshape.com', 'A new design fair focused on materials, craftsmanship and shape.'),
  ('Art Basel Miami Beach 2026', 'art-basel-miami-2026', 'fair', 'Miami Beach', 'United States', 'Miami Beach Convention Center', '2026-12-03', '2026-12-06', 'https://www.artbasel.com/miami-beach', 'Premier international art fair with strong design crossover.'),
  ('Salon Art + Design 2026', 'salon-art-design-2026', 'fair', 'New York', 'United States', 'Park Avenue Armory', '2026-11-05', '2026-11-09', 'https://www.thesalonny.com', 'Manhattan''s most distinguished international fair for collectible 20th and 21st century design.');