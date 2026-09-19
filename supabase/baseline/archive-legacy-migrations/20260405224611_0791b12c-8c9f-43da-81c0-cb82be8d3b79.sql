
-- Material Library: swatches and finishes
CREATE TABLE public.material_swatches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  brand_name text NOT NULL DEFAULT '',
  category text NOT NULL DEFAULT 'fabric',
  color_family text DEFAULT '',
  material_type text DEFAULT '',
  finish text DEFAULT '',
  image_url text DEFAULT '',
  swatch_code text DEFAULT '',
  application text DEFAULT '',
  notes text DEFAULT '',
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.material_swatches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage swatches" ON public.material_swatches FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Trade users can view active swatches" ON public.material_swatches FOR SELECT TO authenticated
  USING (is_active = true AND (has_role(auth.uid(), 'trade_user'::app_role) OR has_role(auth.uid(), 'admin'::app_role)));

-- CPD / Continuing Education events
CREATE TABLE public.cpd_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text DEFAULT '',
  event_type text NOT NULL DEFAULT 'webinar',
  presenter text DEFAULT '',
  brand_name text DEFAULT '',
  date timestamptz,
  duration_minutes int DEFAULT 60,
  location text DEFAULT '',
  video_url text DEFAULT '',
  thumbnail_url text DEFAULT '',
  is_published boolean NOT NULL DEFAULT false,
  max_attendees int DEFAULT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.cpd_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage CPD events" ON public.cpd_events FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Trade users can view published CPD events" ON public.cpd_events FOR SELECT TO authenticated
  USING (is_published = true AND (has_role(auth.uid(), 'trade_user'::app_role) OR has_role(auth.uid(), 'admin'::app_role)));

-- CPD attendance tracking
CREATE TABLE public.cpd_attendance (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid REFERENCES public.cpd_events(id) ON DELETE CASCADE NOT NULL,
  user_id uuid NOT NULL,
  registered_at timestamptz NOT NULL DEFAULT now(),
  attended boolean NOT NULL DEFAULT false,
  attended_at timestamptz,
  UNIQUE (event_id, user_id)
);

ALTER TABLE public.cpd_attendance ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own attendance" ON public.cpd_attendance FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Admins can view all attendance" ON public.cpd_attendance FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));
