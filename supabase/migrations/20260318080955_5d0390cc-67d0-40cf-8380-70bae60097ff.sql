
-- Room planner projects table
CREATE TABLE public.room_planner_projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  name text NOT NULL DEFAULT 'Untitled Project',
  plan_image_url text,
  rooms jsonb NOT NULL DEFAULT '[]'::jsonb,
  placed_products jsonb NOT NULL DEFAULT '[]'::jsonb,
  pixels_per_meter integer NOT NULL DEFAULT 50,
  wall_height numeric NOT NULL DEFAULT 2.8,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE public.room_planner_projects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own planner projects"
  ON public.room_planner_projects
  FOR ALL
  TO authenticated
  USING (user_id = auth.uid() AND (has_role(auth.uid(), 'trade_user'::app_role) OR has_role(auth.uid(), 'admin'::app_role)))
  WITH CHECK (user_id = auth.uid() AND (has_role(auth.uid(), 'trade_user'::app_role) OR has_role(auth.uid(), 'admin'::app_role)));

CREATE POLICY "Admins can view all planner projects"
  ON public.room_planner_projects
  FOR SELECT
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));
