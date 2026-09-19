
-- Presentations table
CREATE TABLE public.presentations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL DEFAULT 'Untitled Presentation',
  description text,
  created_by uuid NOT NULL,
  client_name text,
  project_name text,
  cover_style text NOT NULL DEFAULT 'default',
  is_published boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Presentation slides table
CREATE TABLE public.presentation_slides (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  presentation_id uuid NOT NULL REFERENCES public.presentations(id) ON DELETE CASCADE,
  gallery_item_id uuid REFERENCES public.axonometric_gallery(id) ON DELETE SET NULL,
  image_url text NOT NULL,
  title text NOT NULL DEFAULT '',
  description text,
  project_name text,
  style_preset text,
  sort_order smallint NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE public.presentations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.presentation_slides ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage presentations" ON public.presentations
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Trade users can view published presentations" ON public.presentations
  FOR SELECT TO authenticated
  USING (is_published = true AND (has_role(auth.uid(), 'trade_user'::app_role) OR has_role(auth.uid(), 'admin'::app_role)));

CREATE POLICY "Admins can manage presentation slides" ON public.presentation_slides
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Trade users can view published presentation slides" ON public.presentation_slides
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.presentations
    WHERE presentations.id = presentation_slides.presentation_id
    AND presentations.is_published = true
  ) AND (has_role(auth.uid(), 'trade_user'::app_role) OR has_role(auth.uid(), 'admin'::app_role)));
