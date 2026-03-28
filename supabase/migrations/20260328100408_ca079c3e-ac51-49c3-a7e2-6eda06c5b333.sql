
CREATE TABLE public.scrape_configs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_name text NOT NULL,
  category text NOT NULL DEFAULT 'Uncategorized',
  urls text[] NOT NULL DEFAULT '{}',
  extract_prompt text,
  is_active boolean NOT NULL DEFAULT true,
  schedule_cron text DEFAULT NULL,
  last_run_at timestamptz,
  last_run_result jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL
);

ALTER TABLE public.scrape_configs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage scrape configs"
  ON public.scrape_configs
  FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
