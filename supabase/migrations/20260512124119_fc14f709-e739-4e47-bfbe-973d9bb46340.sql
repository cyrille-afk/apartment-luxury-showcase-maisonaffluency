
-- Replace anon-readable storage.objects SELECT policies for public image buckets
-- with authenticated-only listing. Public direct-URL reads are unaffected
-- because they go through the storage CDN and bypass RLS.
DO $$
DECLARE
  pol record;
BEGIN
  FOR pol IN
    SELECT policyname FROM pg_policies
    WHERE schemaname='storage' AND tablename='objects'
      AND cmd='SELECT'
      AND ('anon' = ANY(roles) OR 'public' = ANY(roles))
      AND qual ~* '''(assets|avatars|designer-images)'''
  LOOP
    EXECUTE format('DROP POLICY %I ON storage.objects', pol.policyname);
  END LOOP;
END $$;

CREATE POLICY "Authenticated can list public image buckets"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id IN ('assets','avatars','designer-images'));
