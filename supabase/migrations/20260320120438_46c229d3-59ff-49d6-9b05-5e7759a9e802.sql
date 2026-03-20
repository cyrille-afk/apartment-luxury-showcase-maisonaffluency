
CREATE TABLE public.competitor_traffic (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  gallery_id uuid NOT NULL REFERENCES public.competitor_galleries(id) ON DELETE CASCADE,
  month date NOT NULL,
  monthly_visits integer,
  bounce_rate numeric(5,2),
  avg_duration_seconds integer,
  source text NOT NULL DEFAULT 'manual',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (gallery_id, month)
);

ALTER TABLE public.competitor_traffic ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage competitor traffic"
  ON public.competitor_traffic FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- Also add a row for Maison Affluency itself (our own site)
INSERT INTO public.competitor_galleries (name, website_url, location, region, description, scrape_status)
VALUES ('Maison Affluency', 'https://maisonaffluency.com', 'Singapore', 'asia', 'Our own site — baseline for comparison', 'n/a')
ON CONFLICT DO NOTHING;
