-- 1. Projects table
CREATE TABLE public.projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  name text NOT NULL DEFAULT 'Untitled Project',
  client_name text NOT NULL DEFAULT '',
  location text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'active', -- active | completed | archived
  color text NOT NULL DEFAULT 'neutral',
  cover_image_url text,
  notes text,
  target_completion_date date,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_projects_user_id ON public.projects(user_id);
CREATE INDEX idx_projects_status ON public.projects(status);

ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Trade users can manage own projects"
  ON public.projects FOR ALL
  TO authenticated
  USING ((user_id = auth.uid()) AND (has_role(auth.uid(), 'trade_user'::app_role) OR has_role(auth.uid(), 'admin'::app_role)))
  WITH CHECK ((user_id = auth.uid()) AND (has_role(auth.uid(), 'trade_user'::app_role) OR has_role(auth.uid(), 'admin'::app_role)));

CREATE POLICY "Admins can manage all projects"
  ON public.projects FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- updated_at trigger reusing existing helper
CREATE TRIGGER tg_projects_updated_at
  BEFORE UPDATE ON public.projects
  FOR EACH ROW EXECUTE FUNCTION public.tms_set_updated_at();

-- 2. Add project_id to existing tables (nullable — leave existing items unassigned)
ALTER TABLE public.trade_quotes
  ADD COLUMN project_id uuid REFERENCES public.projects(id) ON DELETE SET NULL;
CREATE INDEX idx_trade_quotes_project_id ON public.trade_quotes(project_id);

ALTER TABLE public.client_boards
  ADD COLUMN project_id uuid REFERENCES public.projects(id) ON DELETE SET NULL;
CREATE INDEX idx_client_boards_project_id ON public.client_boards(project_id);

ALTER TABLE public.order_timeline
  ADD COLUMN project_id uuid REFERENCES public.projects(id) ON DELETE SET NULL;
CREATE INDEX idx_order_timeline_project_id ON public.order_timeline(project_id);