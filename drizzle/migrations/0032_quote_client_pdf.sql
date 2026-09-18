ALTER TABLE public.trade_quotes
  ADD COLUMN IF NOT EXISTS client_pdf_path text,
  ADD COLUMN IF NOT EXISTS client_pdf_updated_at timestamptz;

CREATE POLICY "Admins manage quote pdfs"
ON storage.objects FOR ALL
TO authenticated
USING (bucket_id = 'quote-pdfs' AND public.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (bucket_id = 'quote-pdfs' AND public.has_role(auth.uid(), 'admin'::app_role));
