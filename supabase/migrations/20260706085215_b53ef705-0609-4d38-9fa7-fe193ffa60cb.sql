
DROP POLICY IF EXISTS "Anyone can log studio lead events" ON public.studio_lead_events;

CREATE POLICY "Anyone can log studio lead events"
ON public.studio_lead_events
FOR INSERT
WITH CHECK (
  studio_id IS NOT NULL
  AND EXISTS (SELECT 1 FROM public.studios s WHERE s.id = studio_id)
  AND event_type IS NOT NULL
  AND char_length(event_type) <= 64
  AND (cta_kind IS NULL OR char_length(cta_kind) <= 64)
  AND (filter_key IS NULL OR char_length(filter_key) <= 64)
  AND (filter_value IS NULL OR char_length(filter_value) <= 256)
  AND (visitor_hash IS NULL OR char_length(visitor_hash) <= 128)
  AND (user_agent IS NULL OR char_length(user_agent) <= 500)
  AND (referrer IS NULL OR char_length(referrer) <= 500)
);
