
CREATE POLICY "Anyone can view featured public document"
ON public.trade_documents
FOR SELECT
TO anon, authenticated
USING (is_featured_public = true);
