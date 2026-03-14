-- Allow admins to upload files to the assets bucket
CREATE POLICY "Admins can upload assets"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'assets'
  AND public.has_role(auth.uid(), 'admin')
);

-- Allow admins to update files in the assets bucket
CREATE POLICY "Admins can update assets"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'assets'
  AND public.has_role(auth.uid(), 'admin')
)
WITH CHECK (
  bucket_id = 'assets'
  AND public.has_role(auth.uid(), 'admin')
);

-- Allow admins to delete files from the assets bucket
CREATE POLICY "Admins can delete assets"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'assets'
  AND public.has_role(auth.uid(), 'admin')
);