
-- Provenance certificates for collectible pieces
CREATE TABLE public.provenance_certificates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Link to piece by designer_id + piece_title (matches hardcoded data)
  designer_id text NOT NULL,
  piece_title text NOT NULL,
  -- Certificate details
  edition_number text,
  edition_total text,
  year_created smallint,
  certificate_number text,
  authenticity_statement text DEFAULT 'This certificate confirms the authenticity and provenance of this collectible design piece, verified by Maison Affluency.',
  -- Investment data
  estimated_value_range text,
  appreciation_notes text,
  comparable_references text,
  -- Metadata
  is_published boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id),
  UNIQUE (designer_id, piece_title)
);

-- Provenance timeline events
CREATE TABLE public.provenance_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  certificate_id uuid NOT NULL REFERENCES public.provenance_certificates(id) ON DELETE CASCADE,
  event_date text NOT NULL,
  event_type text NOT NULL DEFAULT 'milestone',
  title text NOT NULL,
  description text,
  location text,
  sort_order smallint NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.provenance_certificates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.provenance_events ENABLE ROW LEVEL SECURITY;

-- Public can view published certificates
CREATE POLICY "Anyone can view published certificates"
  ON public.provenance_certificates FOR SELECT
  TO anon, authenticated
  USING (is_published = true);

-- Admins can manage certificates
CREATE POLICY "Admins can manage certificates"
  ON public.provenance_certificates FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'admin'))
  WITH CHECK (has_role(auth.uid(), 'admin'));

-- Public can view events of published certificates
CREATE POLICY "Anyone can view published certificate events"
  ON public.provenance_events FOR SELECT
  TO anon, authenticated
  USING (EXISTS (
    SELECT 1 FROM public.provenance_certificates
    WHERE id = provenance_events.certificate_id AND is_published = true
  ));

-- Admins can manage events
CREATE POLICY "Admins can manage certificate events"
  ON public.provenance_events FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'admin'))
  WITH CHECK (has_role(auth.uid(), 'admin'));
