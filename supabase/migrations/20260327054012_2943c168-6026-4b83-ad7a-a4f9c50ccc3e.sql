
CREATE TABLE public.document_downloads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  document_id uuid NOT NULL REFERENCES public.trade_documents(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.document_downloads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can insert own downloads"
  ON public.document_downloads FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid() AND (public.has_role(auth.uid(), 'trade_user') OR public.has_role(auth.uid(), 'admin')));

CREATE POLICY "Admins can view all downloads"
  ON public.document_downloads FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users can view own downloads"
  ON public.document_downloads FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE INDEX idx_document_downloads_user_id ON public.document_downloads(user_id);
CREATE INDEX idx_document_downloads_document_id ON public.document_downloads(document_id);
