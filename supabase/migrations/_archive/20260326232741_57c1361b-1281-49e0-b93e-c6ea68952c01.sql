
CREATE TABLE public.client_taste_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  cluster_label text NOT NULL DEFAULT '',
  cluster_description text DEFAULT '',
  top_designers text[] DEFAULT '{}',
  top_brands text[] DEFAULT '{}',
  top_categories text[] DEFAULT '{}',
  top_materials text[] DEFAULT '{}',
  style_keywords text[] DEFAULT '{}',
  engagement_score numeric DEFAULT 0,
  total_favorites integer DEFAULT 0,
  total_quotes integer DEFAULT 0,
  total_samples integer DEFAULT 0,
  raw_signals jsonb DEFAULT '{}'::jsonb,
  computed_at timestamp with time zone NOT NULL DEFAULT now(),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (user_id)
);

ALTER TABLE public.client_taste_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage taste profiles"
  ON public.client_taste_profiles FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));
