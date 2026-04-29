-- 1. Owner column on featured_studios
ALTER TABLE public.featured_studios
  ADD COLUMN IF NOT EXISTS owner_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_featured_studios_owner ON public.featured_studios(owner_user_id);

-- 2. Helper to check studio ownership
CREATE OR REPLACE FUNCTION public.is_studio_owner(_user_id uuid, _studio_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.featured_studios
    WHERE id = _studio_id AND owner_user_id = _user_id
  );
$$;

-- 3. Lead events table
CREATE TABLE IF NOT EXISTS public.studio_lead_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  studio_id uuid REFERENCES public.featured_studios(id) ON DELETE CASCADE,
  event_type text NOT NULL CHECK (event_type IN (
    'profile_view', 'cta_click', 'directory_card_click', 'filter_applied'
  )),
  cta_kind text CHECK (cta_kind IN ('website', 'email', 'instagram', 'contact_form')),
  filter_key text,
  filter_value text,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  visitor_hash text,
  user_agent text,
  referrer text,
  country text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sle_studio_created ON public.studio_lead_events(studio_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sle_event_type ON public.studio_lead_events(event_type);
CREATE INDEX IF NOT EXISTS idx_sle_created ON public.studio_lead_events(created_at DESC);

ALTER TABLE public.studio_lead_events ENABLE ROW LEVEL SECURITY;

-- Anyone can insert an event (public tracking)
CREATE POLICY "Anyone can log studio lead events"
  ON public.studio_lead_events
  FOR INSERT
  WITH CHECK (true);

-- Owners and admins can read events for their studio
CREATE POLICY "Owners and admins can view studio lead events"
  ON public.studio_lead_events
  FOR SELECT
  USING (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR (studio_id IS NOT NULL AND public.is_studio_owner(auth.uid(), studio_id))
  );

-- Admins can manage (delete cleanup, etc.)
CREATE POLICY "Admins can delete studio lead events"
  ON public.studio_lead_events
  FOR DELETE
  USING (public.has_role(auth.uid(), 'admin'::app_role));