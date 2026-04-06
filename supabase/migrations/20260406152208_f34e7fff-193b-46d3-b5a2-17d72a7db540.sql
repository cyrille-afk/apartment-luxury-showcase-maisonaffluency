-- Make bucket private
UPDATE storage.buckets SET public = false WHERE id = 'spec-sheets';

-- Remove public SELECT policy
DROP POLICY IF EXISTS "Spec sheets are publicly accessible" ON storage.objects;

-- Add trade-user-scoped SELECT policy
CREATE POLICY "Trade users and admins can view spec sheets"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'spec-sheets'
  AND (
    has_role(auth.uid(), 'trade_user'::app_role)
    OR has_role(auth.uid(), 'admin'::app_role)
  )
);