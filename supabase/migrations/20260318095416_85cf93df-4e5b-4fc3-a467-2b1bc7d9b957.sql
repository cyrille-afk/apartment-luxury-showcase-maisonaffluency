
-- Gallery of saved axonometric renders
CREATE TABLE public.axonometric_gallery (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  created_by UUID NOT NULL,
  title TEXT NOT NULL DEFAULT '',
  description TEXT,
  image_url TEXT NOT NULL,
  style_preset TEXT,
  project_name TEXT,
  request_id UUID REFERENCES public.axonometric_requests(id) ON DELETE SET NULL,
  is_published BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.axonometric_gallery ENABLE ROW LEVEL SECURITY;

-- Admins can manage all gallery items
CREATE POLICY "Admins can manage axonometric gallery"
  ON public.axonometric_gallery
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Trade users can view published gallery items
CREATE POLICY "Trade users can view published axonometric gallery"
  ON public.axonometric_gallery
  FOR SELECT TO authenticated
  USING (
    is_published = true AND (
      has_role(auth.uid(), 'trade_user'::app_role) OR has_role(auth.uid(), 'admin'::app_role)
    )
  );

-- Add image attachment field to quote items for axonometric renders
ALTER TABLE public.trade_quote_items ADD COLUMN IF NOT EXISTS axonometric_image_url TEXT;
