DROP POLICY "Studio editors can upload client document files" ON storage.objects;
CREATE POLICY "Studio editors can upload client document files"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'client-documents' AND can_edit_studio(auth.uid(), ((storage.foldername(name))[1])::uuid));