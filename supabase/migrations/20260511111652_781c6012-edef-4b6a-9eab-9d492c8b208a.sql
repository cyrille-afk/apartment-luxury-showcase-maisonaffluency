
CREATE TABLE IF NOT EXISTS public.magazine_badge_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id uuid REFERENCES public.trade_documents(id) ON DELETE SET NULL,
  document_label text DEFAULT '',
  event_type text NOT NULL CHECK (event_type IN ('impression','click')),
  source text NOT NULL DEFAULT '',
  country text DEFAULT '',
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS magazine_badge_events_doc_idx ON public.magazine_badge_events(document_id);
CREATE INDEX IF NOT EXISTS magazine_badge_events_created_idx ON public.magazine_badge_events(created_at DESC);
CREATE INDEX IF NOT EXISTS magazine_badge_events_type_idx ON public.magazine_badge_events(event_type);

ALTER TABLE public.magazine_badge_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can read magazine badge events"
  ON public.magazine_badge_events
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Anyone can insert magazine badge events"
  ON public.magazine_badge_events
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);
