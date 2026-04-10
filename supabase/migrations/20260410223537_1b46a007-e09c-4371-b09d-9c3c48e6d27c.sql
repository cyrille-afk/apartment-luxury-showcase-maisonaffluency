
ALTER TABLE public.document_downloads
ADD COLUMN country text NOT NULL DEFAULT '';

CREATE INDEX idx_document_downloads_country ON public.document_downloads (country);
