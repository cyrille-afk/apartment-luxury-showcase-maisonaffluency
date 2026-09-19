CREATE OR REPLACE FUNCTION public.realtime_topic_allowed(_topic text, _uid uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    _uid IS NOT NULL
    AND (
      _topic = 'user:' || _uid::text
      OR _topic LIKE ('user:' || _uid::text || '-%')
      OR _topic = 'notifications-' || _uid::text
      OR _topic = 'pending-invites-' || _uid::text
      OR _topic = 'studio-memberships-' || _uid::text
      OR _topic = 'sample-requests-' || _uid::text
      OR (
        _topic LIKE 'concierge:%'
        AND EXISTS (
          SELECT 1 FROM public.concierge_stream_sessions s
          WHERE s.stream_id::text = substring(_topic from 11)
            AND s.user_id = _uid
        )
      )
      OR (
        _topic LIKE 'studio-%'
        AND EXISTS (
          SELECT 1 FROM public.studio_members m
          WHERE m.user_id = _uid
            AND _topic = 'studio-' || m.studio_id::text
        )
      )
      OR (
        _topic LIKE 'quote-%'
        AND EXISTS (
          SELECT 1 FROM public.trade_quotes q
          WHERE _topic = 'quote-' || q.id::text
            AND (
              q.user_id = _uid
              OR (
                q.studio_id IS NOT NULL
                AND EXISTS (
                  SELECT 1 FROM public.studio_members m
                  WHERE m.studio_id = q.studio_id AND m.user_id = _uid
                )
              )
            )
        )
      )
    )
$$;

REVOKE ALL ON FUNCTION public.realtime_topic_allowed(text, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.realtime_topic_allowed(text, uuid) TO authenticated;

DROP POLICY IF EXISTS "users can subscribe to their own topic" ON realtime.messages;
CREATE POLICY "users can subscribe to their own topic"
ON realtime.messages
FOR SELECT
TO authenticated
USING (public.realtime_topic_allowed(realtime.topic(), auth.uid()));

DROP POLICY IF EXISTS "users can broadcast to their own topic" ON realtime.messages;
CREATE POLICY "users can broadcast to their own topic"
ON realtime.messages
FOR INSERT
TO authenticated
WITH CHECK (public.realtime_topic_allowed(realtime.topic(), auth.uid()));

DROP POLICY IF EXISTS "Anyone can view sitemap product URLs" ON public.sitemap_products;
DROP POLICY IF EXISTS "Public can view sitemap URLs for public products" ON public.sitemap_products;
CREATE POLICY "Public can view sitemap URLs for public products"
ON public.sitemap_products
FOR SELECT
TO anon, authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.trade_products tp
    WHERE tp.id = sitemap_products.id
      AND tp.is_active IS TRUE
      AND COALESCE(tp.is_hidden, false) IS FALSE
  )
);