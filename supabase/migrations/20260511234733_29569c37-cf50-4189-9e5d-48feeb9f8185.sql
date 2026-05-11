
-- Document type enum
CREATE TYPE public.client_document_type AS ENUM ('nda', 'terms', 'counterparty', 'kyc', 'contract', 'other');
CREATE TYPE public.client_document_storage AS ENUM ('link', 'upload');

CREATE TABLE public.client_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  studio_id uuid NOT NULL REFERENCES public.studios(id) ON DELETE CASCADE,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  doc_type public.client_document_type NOT NULL DEFAULT 'other',
  label text NOT NULL,
  storage_kind public.client_document_storage NOT NULL DEFAULT 'link',
  external_url text,
  storage_path text,
  file_name text,
  file_size_bytes bigint,
  mime_type text,
  signed_at date,
  expires_at date,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT client_documents_payload_chk CHECK (
    (storage_kind = 'link'   AND external_url IS NOT NULL AND length(external_url) > 0)
 OR (storage_kind = 'upload' AND storage_path IS NOT NULL AND length(storage_path) > 0)
  )
);

CREATE INDEX idx_client_documents_client ON public.client_documents(client_id);
CREATE INDEX idx_client_documents_studio ON public.client_documents(studio_id);

CREATE TRIGGER trg_client_documents_updated_at
BEFORE UPDATE ON public.client_documents
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.client_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Studio members can view client documents"
ON public.client_documents FOR SELECT
USING (public.can_view_studio(auth.uid(), studio_id) OR public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Studio editors can insert client documents"
ON public.client_documents FOR INSERT
WITH CHECK (
  public.can_edit_studio(auth.uid(), studio_id)
  AND created_by = auth.uid()
  AND EXISTS (SELECT 1 FROM public.clients c WHERE c.id = client_id AND c.studio_id = client_documents.studio_id)
);

CREATE POLICY "Studio editors can update client documents"
ON public.client_documents FOR UPDATE
USING (public.can_edit_studio(auth.uid(), studio_id))
WITH CHECK (public.can_edit_studio(auth.uid(), studio_id));

CREATE POLICY "Studio editors can delete client documents"
ON public.client_documents FOR DELETE
USING (public.can_edit_studio(auth.uid(), studio_id));

-- Private storage bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('client-documents', 'client-documents', false)
ON CONFLICT (id) DO NOTHING;

-- Storage RLS: files live under {studio_id}/{client_id}/{filename}
CREATE POLICY "Studio members can read client document files"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'client-documents'
  AND public.can_view_studio(auth.uid(), ((storage.foldername(name))[1])::uuid)
);

CREATE POLICY "Studio editors can upload client document files"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'client-documents'
  AND public.can_edit_studio(auth.uid(), ((storage.foldername(name))[1])::uuid)
);

CREATE POLICY "Studio editors can update client document files"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'client-documents'
  AND public.can_edit_studio(auth.uid(), ((storage.foldername(name))[1])::uuid)
);

CREATE POLICY "Studio editors can delete client document files"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'client-documents'
  AND public.can_edit_studio(auth.uid(), ((storage.foldername(name))[1])::uuid)
);
