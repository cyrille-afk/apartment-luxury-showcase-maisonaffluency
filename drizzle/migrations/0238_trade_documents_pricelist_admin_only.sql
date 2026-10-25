DROP POLICY IF EXISTS "Trade users can view documents" ON public.trade_documents;
CREATE POLICY "Trade users can view documents" ON public.trade_documents FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::app_role)
  OR (public.has_role(auth.uid(), 'trade_user'::app_role) AND document_type <> 'pricelist')
);
DROP POLICY IF EXISTS "Anyone can view featured public document" ON public.trade_documents;
CREATE POLICY "Anyone can view featured public document" ON public.trade_documents FOR SELECT
USING (is_featured_public = true AND document_type <> 'pricelist');