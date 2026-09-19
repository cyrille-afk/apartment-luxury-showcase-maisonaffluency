
-- ============ Floor plans storage: stricter ownership ============
DROP POLICY IF EXISTS "users upload own floor plan files" ON storage.objects;
DROP POLICY IF EXISTS "users read own floor plan files" ON storage.objects;
DROP POLICY IF EXISTS "users update own floor plan files" ON storage.objects;
DROP POLICY IF EXISTS "users delete own floor plan files" ON storage.objects;

CREATE POLICY "users upload own floor plan files"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'floor-plans'
  AND (auth.uid())::text = (storage.foldername(name))[1]
  AND (
    (storage.foldername(name))[2] IS NULL
    OR EXISTS (
      SELECT 1 FROM public.trade_floor_plans fp
      WHERE fp.id::text = (storage.foldername(name))[2]
        AND fp.user_id = auth.uid()
    )
  )
);

CREATE POLICY "users read own floor plan files"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'floor-plans'
  AND (
    has_role(auth.uid(), 'admin'::app_role)
    OR (
      (auth.uid())::text = (storage.foldername(name))[1]
      AND (
        (storage.foldername(name))[2] IS NULL
        OR EXISTS (
          SELECT 1 FROM public.trade_floor_plans fp
          WHERE fp.id::text = (storage.foldername(name))[2]
            AND fp.user_id = auth.uid()
        )
      )
    )
  )
);

CREATE POLICY "users update own floor plan files"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'floor-plans'
  AND (
    has_role(auth.uid(), 'admin'::app_role)
    OR (
      (auth.uid())::text = (storage.foldername(name))[1]
      AND (
        (storage.foldername(name))[2] IS NULL
        OR EXISTS (
          SELECT 1 FROM public.trade_floor_plans fp
          WHERE fp.id::text = (storage.foldername(name))[2]
            AND fp.user_id = auth.uid()
        )
      )
    )
  )
);

CREATE POLICY "users delete own floor plan files"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'floor-plans'
  AND (
    has_role(auth.uid(), 'admin'::app_role)
    OR (
      (auth.uid())::text = (storage.foldername(name))[1]
      AND (
        (storage.foldername(name))[2] IS NULL
        OR EXISTS (
          SELECT 1 FROM public.trade_floor_plans fp
          WHERE fp.id::text = (storage.foldername(name))[2]
            AND fp.user_id = auth.uid()
        )
      )
    )
  )
);

-- ============ Realtime topics: strict allow-list ============
DROP POLICY IF EXISTS "users can broadcast to their own topic" ON realtime.messages;
DROP POLICY IF EXISTS "users can subscribe to their own topic" ON realtime.messages;

CREATE POLICY "users can broadcast to their own topic"
ON realtime.messages FOR INSERT TO authenticated
WITH CHECK (
  realtime.topic() = ('user:' || (auth.uid())::text)
  OR realtime.topic() LIKE ('user:' || (auth.uid())::text || '-%')
  OR realtime.topic() = ('notifications-' || (auth.uid())::text)
  OR realtime.topic() = ('pending-invites-' || (auth.uid())::text)
  OR realtime.topic() = ('studio-memberships-' || (auth.uid())::text)
  OR realtime.topic() = ('sample-requests-' || (auth.uid())::text)
);

CREATE POLICY "users can subscribe to their own topic"
ON realtime.messages FOR SELECT TO authenticated
USING (
  realtime.topic() = ('user:' || (auth.uid())::text)
  OR realtime.topic() LIKE ('user:' || (auth.uid())::text || '-%')
  OR realtime.topic() = ('notifications-' || (auth.uid())::text)
  OR realtime.topic() = ('pending-invites-' || (auth.uid())::text)
  OR realtime.topic() = ('studio-memberships-' || (auth.uid())::text)
  OR realtime.topic() = ('sample-requests-' || (auth.uid())::text)
);
