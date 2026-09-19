
CREATE TABLE public.video_watch_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id text NOT NULL,
  event_type text NOT NULL,
  video_id text NOT NULL DEFAULT 'apartment-tour',
  progress_percent smallint,
  watch_duration_seconds numeric,
  user_agent text,
  referrer text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.video_watch_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can insert video watch events"
  ON public.video_watch_events
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "Admins can view video watch events"
  ON public.video_watch_events
  FOR SELECT
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE INDEX idx_video_watch_events_video_id ON public.video_watch_events (video_id);
CREATE INDEX idx_video_watch_events_created_at ON public.video_watch_events (created_at);
