-- 1) Fabric pricing: private pricing tables are trade/admin only.
DROP POLICY IF EXISTS "Authenticated users can read active fabrics" ON public.fabrics;
CREATE POLICY "Trade users and admins can read active fabric pricing"
ON public.fabrics
FOR SELECT
TO authenticated
USING (
  is_active = true
  AND (
    public.has_role(auth.uid(), 'trade_user'::public.app_role)
    OR public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'super_admin'::public.app_role)
  )
);

DROP POLICY IF EXISTS "Authenticated users can read product fabrics" ON public.product_fabrics;
CREATE POLICY "Trade users and admins can read product fabric pricing links"
ON public.product_fabrics
FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'trade_user'::public.app_role)
  OR public.has_role(auth.uid(), 'admin'::public.app_role)
  OR public.has_role(auth.uid(), 'super_admin'::public.app_role)
);

-- 2) Studio membership: no self-join into arbitrary studios.
CREATE OR REPLACE FUNCTION public.add_studio_creator_member()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.studio_members (studio_id, user_id, role, invited_by)
  VALUES (NEW.id, NEW.created_by, 'owner'::public.studio_role, NEW.created_by)
  ON CONFLICT (studio_id, user_id) DO NOTHING;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.add_studio_creator_member() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.add_studio_creator_member() FROM anon;
REVOKE ALL ON FUNCTION public.add_studio_creator_member() FROM authenticated;
GRANT EXECUTE ON FUNCTION public.add_studio_creator_member() TO service_role;

DROP TRIGGER IF EXISTS add_studio_creator_member_trigger ON public.studios;
CREATE TRIGGER add_studio_creator_member_trigger
AFTER INSERT ON public.studios
FOR EACH ROW
EXECUTE FUNCTION public.add_studio_creator_member();

DROP POLICY IF EXISTS "Owners/admins can add members" ON public.studio_members;
CREATE POLICY "Platform admins can add studio members"
ON public.studio_members
FOR INSERT
TO authenticated
WITH CHECK (
  public.has_role(auth.uid(), 'admin'::public.app_role)
  OR public.has_role(auth.uid(), 'super_admin'::public.app_role)
);

-- 3) Axonometric storage: users can delete only objects under their own UID path.
DROP POLICY IF EXISTS "Trade users can delete own axonometric sources" ON storage.objects;
CREATE POLICY "Trade users can delete own axonometric sources"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'assets'
  AND (storage.foldername(name))[1] = 'axonometric-sources'
  AND (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'super_admin'::public.app_role)
    OR (
      public.has_role(auth.uid(), 'trade_user'::public.app_role)
      AND (storage.foldername(name))[2] = auth.uid()::text
    )
  )
);

DROP POLICY IF EXISTS "Trade users can delete own axonometric submissions" ON storage.objects;
CREATE POLICY "Trade users can delete own axonometric submissions"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'assets'
  AND (storage.foldername(name))[1] = 'axonometric-submissions'
  AND (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'super_admin'::public.app_role)
    OR (
      public.has_role(auth.uid(), 'trade_user'::public.app_role)
      AND (storage.foldername(name))[2] = auth.uid()::text
    )
  )
);

DROP POLICY IF EXISTS "Trade users can upload axonometric sources" ON storage.objects;
CREATE POLICY "Trade users can upload axonometric sources"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'assets'
  AND (storage.foldername(name))[1] = 'axonometric-sources'
  AND (storage.foldername(name))[2] = auth.uid()::text
  AND (
    public.has_role(auth.uid(), 'trade_user'::public.app_role)
    OR public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'super_admin'::public.app_role)
  )
);

DROP POLICY IF EXISTS "Trade users can upload axonometric submissions" ON storage.objects;
CREATE POLICY "Trade users can upload axonometric submissions"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'assets'
  AND (storage.foldername(name))[1] = 'axonometric-submissions'
  AND (storage.foldername(name))[2] = auth.uid()::text
  AND (
    public.has_role(auth.uid(), 'trade_user'::public.app_role)
    OR public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'super_admin'::public.app_role)
  )
);

-- 4) Presentation comments: remove table-wide realtime publication.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'presentation_comments'
  ) THEN
    ALTER PUBLICATION supabase_realtime DROP TABLE public.presentation_comments;
  END IF;
END $$;