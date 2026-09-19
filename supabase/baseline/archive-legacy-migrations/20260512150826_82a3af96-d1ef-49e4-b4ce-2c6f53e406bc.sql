
CREATE TABLE IF NOT EXISTS public.tour_events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  event_type TEXT NOT NULL CHECK (event_type IN ('tour_step_view','tour_substep_click','tour_complete','tour_skip')),
  user_id UUID,
  step_id TEXT,
  step_index INTEGER,
  total_steps INTEGER,
  sub_step_id TEXT,
  sub_step_label TEXT,
  target_path TEXT,
  device_type TEXT,
  platform TEXT,
  viewport TEXT,
  pwa_standalone BOOLEAN,
  language TEXT,
  page_path TEXT,
  referrer_host TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tour_events_created_at ON public.tour_events(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_tour_events_type ON public.tour_events(event_type);
CREATE INDEX IF NOT EXISTS idx_tour_events_device ON public.tour_events(device_type);
CREATE INDEX IF NOT EXISTS idx_tour_events_user ON public.tour_events(user_id);

ALTER TABLE public.tour_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can log tour events"
ON public.tour_events FOR INSERT
WITH CHECK (true);

CREATE POLICY "Admins can view tour events"
ON public.tour_events FOR SELECT
USING (public.has_role(auth.uid(), 'admin'::app_role));
