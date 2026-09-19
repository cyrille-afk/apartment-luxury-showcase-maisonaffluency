
ALTER TABLE public.document_downloads
ALTER COLUMN document_id DROP NOT NULL;

ALTER TABLE public.document_downloads
ADD COLUMN document_label text NOT NULL DEFAULT '';
