CREATE TABLE IF NOT EXISTS public.public_download_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id uuid NULL REFERENCES public.trade_documents(id) ON DELETE SET NULL,
  document_label text NOT NULL DEFAULT '',
  country text NOT NULL DEFAULT '',
  source text NOT NULL DEFAULT 'public',
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.public_download_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view public download events"
ON public.public_download_events
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Service role can insert public download events"
ON public.public_download_events
FOR INSERT
TO public
WITH CHECK (auth.role() = 'service_role');

CREATE INDEX IF NOT EXISTS idx_public_download_events_created_at
ON public.public_download_events (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_public_download_events_document_id
ON public.public_download_events (document_id);

CREATE OR REPLACE FUNCTION public.log_public_download_event(
  _document_id uuid DEFAULT NULL,
  _document_label text DEFAULT '',
  _country text DEFAULT '',
  _source text DEFAULT 'public'
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _event_id uuid;
BEGIN
  INSERT INTO public.public_download_events (document_id, document_label, country, source)
  VALUES (_document_id, COALESCE(_document_label, ''), COALESCE(_country, ''), COALESCE(_source, 'public'))
  RETURNING id INTO _event_id;

  RETURN _event_id;
END;
$$;

REVOKE ALL ON FUNCTION public.log_public_download_event(uuid, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.log_public_download_event(uuid, text, text, text) TO service_role;