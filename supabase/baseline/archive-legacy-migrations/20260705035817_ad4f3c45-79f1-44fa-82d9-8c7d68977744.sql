
-- FIX 1: designers — trade users must only see published rows
DROP POLICY IF EXISTS "Trade users can view all designers" ON public.designers;
CREATE POLICY "Trade users can view published designers"
ON public.designers
FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'trade_user'::app_role)
  AND is_published = true
);

-- FIX 2: tighten INSERT WITH CHECK on lead/tracking tables to prevent
-- unauthenticated flooding with unbounded free-text payloads.

-- concierge_leads
DROP POLICY IF EXISTS "Anyone can insert a concierge lead" ON public.concierge_leads;
CREATE POLICY "Anyone can insert a concierge lead"
ON public.concierge_leads
FOR INSERT
TO anon, authenticated
WITH CHECK (
  ((user_id IS NULL) OR (user_id = auth.uid()))
  AND surface IN ('public','trade')
  AND session_id IS NOT NULL
  AND char_length(session_id) BETWEEN 1 AND 200
  AND (name IS NULL OR char_length(name) <= 200)
  AND (city IS NULL OR char_length(city) <= 120)
  AND (country IS NULL OR char_length(country) <= 120)
  AND (first_message IS NULL OR char_length(first_message) <= 5000)
  AND (intent IS NULL OR char_length(intent) <= 200)
  AND (path IS NULL OR char_length(path) <= 500)
  AND (user_agent IS NULL OR char_length(user_agent) <= 500)
  AND (referrer IS NULL OR char_length(referrer) <= 500)
);

-- studio_submissions
DROP POLICY IF EXISTS "Anyone can submit a studio" ON public.studio_submissions;
CREATE POLICY "Anyone can submit a studio"
ON public.studio_submissions
FOR INSERT
TO anon, authenticated
WITH CHECK (
  ((user_id IS NULL) OR (user_id = auth.uid()))
  AND char_length(studio_name) BETWEEN 1 AND 200
  AND char_length(contact_name) BETWEEN 1 AND 200
  AND char_length(email) BETWEEN 3 AND 320
  AND email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'
  AND (phone IS NULL OR char_length(phone) <= 64)
  AND (website IS NULL OR char_length(website) <= 500)
  AND (instagram IS NULL OR char_length(instagram) <= 200)
  AND (location IS NULL OR char_length(location) <= 200)
  AND (country IS NULL OR char_length(country) <= 120)
  AND (portfolio_url IS NULL OR char_length(portfolio_url) <= 500)
  AND (about IS NULL OR char_length(about) <= 5000)
  AND (notable_projects IS NULL OR char_length(notable_projects) <= 5000)
  AND coalesce(array_length(disciplines, 1), 0) <= 20
  AND coalesce(array_length(project_types, 1), 0) <= 20
  AND (user_agent IS NULL OR char_length(user_agent) <= 500)
  AND (referrer IS NULL OR char_length(referrer) <= 500)
);

-- magazine_badge_events
DROP POLICY IF EXISTS "Anyone can insert magazine badge events" ON public.magazine_badge_events;
CREATE POLICY "Anyone can insert magazine badge events"
ON public.magazine_badge_events
FOR INSERT
TO anon, authenticated
WITH CHECK (
  event_type IN ('impression','click')
  AND (document_label IS NULL OR char_length(document_label) <= 200)
  AND char_length(source) <= 100
  AND (country IS NULL OR char_length(country) <= 120)
  AND ((user_id IS NULL) OR (user_id = auth.uid()))
);

-- tour_events
DROP POLICY IF EXISTS "Anyone can log tour events" ON public.tour_events;
CREATE POLICY "Anyone can log tour events"
ON public.tour_events
FOR INSERT
TO anon, authenticated
WITH CHECK (
  event_type IN ('tour_step_view','tour_substep_click','tour_complete','tour_skip')
  AND ((user_id IS NULL) OR (user_id = auth.uid()))
  AND (step_id IS NULL OR char_length(step_id) <= 200)
  AND (sub_step_id IS NULL OR char_length(sub_step_id) <= 200)
  AND (sub_step_label IS NULL OR char_length(sub_step_label) <= 300)
  AND (target_path IS NULL OR char_length(target_path) <= 500)
  AND (device_type IS NULL OR char_length(device_type) <= 40)
  AND (platform IS NULL OR char_length(platform) <= 40)
  AND (viewport IS NULL OR char_length(viewport) <= 40)
  AND (language IS NULL OR char_length(language) <= 20)
  AND (page_path IS NULL OR char_length(page_path) <= 500)
  AND (referrer_host IS NULL OR char_length(referrer_host) <= 200)
);

-- video_watch_events
DROP POLICY IF EXISTS "Anyone can insert video watch events" ON public.video_watch_events;
CREATE POLICY "Anyone can insert video watch events"
ON public.video_watch_events
FOR INSERT
TO anon, authenticated
WITH CHECK (
  video_id IS NOT NULL AND char_length(video_id) <= 200
  AND session_id IS NOT NULL AND char_length(session_id) BETWEEN 1 AND 200
  AND event_type IS NOT NULL AND char_length(event_type) <= 64
  AND (progress_percent IS NULL OR (progress_percent BETWEEN 0 AND 100))
  AND (watch_duration_seconds IS NULL OR (watch_duration_seconds >= 0 AND watch_duration_seconds <= 86400))
  AND (user_agent IS NULL OR char_length(user_agent) <= 500)
  AND (referrer IS NULL OR char_length(referrer) <= 500)
);

-- FIX 3: studio_payout_accounts — allow studio 'admin' role (in addition to owner)
-- to manage payout details. Platform admins retained. Editor/viewer excluded.
DROP POLICY IF EXISTS "Payout accounts read (owner or platform admin)" ON public.studio_payout_accounts;
DROP POLICY IF EXISTS "Payout accounts write (owner or platform admin)" ON public.studio_payout_accounts;

CREATE POLICY "Payout accounts read (studio admin+ or platform admin)"
ON public.studio_payout_accounts
FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR has_studio_role(auth.uid(), studio_id, 'admin'::studio_role)
);

CREATE POLICY "Payout accounts write (studio admin+ or platform admin)"
ON public.studio_payout_accounts
FOR ALL
TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR has_studio_role(auth.uid(), studio_id, 'admin'::studio_role)
)
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role)
  OR has_studio_role(auth.uid(), studio_id, 'admin'::studio_role)
);
