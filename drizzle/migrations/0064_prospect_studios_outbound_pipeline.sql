CREATE TABLE IF NOT EXISTS public.prospect_studios (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  studio_name text NOT NULL,
  founder_name text,
  business_email text NOT NULL,
  website_url text,
  recent_design_keywords text[] NOT NULL DEFAULT '{}',
  website_summary text,
  lead_source text NOT NULL DEFAULT 'api',
  aesthetic_label text,
  aesthetic_summary text,
  matched_designers jsonb NOT NULL DEFAULT '[]'::jsonb,
  enrichment_status text NOT NULL DEFAULT 'pending',
  enrichment_error text,
  enrichment_attempts integer NOT NULL DEFAULT 0,
  enriched_at timestamptz,
  claimed_at timestamptz,
  email_sent_status boolean NOT NULL DEFAULT false,
  email_sent_at timestamptz,
  email_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT prospect_studios_email_unique UNIQUE (business_email),
  CONSTRAINT prospect_studios_status_check CHECK (enrichment_status IN ('pending','processing','complete','failed'))
);

CREATE INDEX IF NOT EXISTS idx_prospect_studios_status ON public.prospect_studios (enrichment_status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_prospect_studios_email_sent ON public.prospect_studios (email_sent_status, created_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.prospect_studios TO authenticated;
GRANT ALL ON public.prospect_studios TO service_role;

ALTER TABLE public.prospect_studios ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins manage prospect studios" ON public.prospect_studios;
CREATE POLICY "Admins manage prospect studios"
ON public.prospect_studios
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE OR REPLACE FUNCTION public.set_prospect_studios_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prospect_studios_updated_at ON public.prospect_studios;
CREATE TRIGGER trg_prospect_studios_updated_at
BEFORE UPDATE ON public.prospect_studios
FOR EACH ROW EXECUTE FUNCTION public.set_prospect_studios_updated_at();

-- Bounded, concurrency-safe claim of pending leads for the enrichment worker.
CREATE OR REPLACE FUNCTION public.claim_prospect_enrichment(batch_size integer DEFAULT 5)
RETURNS SETOF public.prospect_studios
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  UPDATE public.prospect_studios p
  SET enrichment_status = 'processing',
      claimed_at = now(),
      enrichment_attempts = p.enrichment_attempts + 1
  WHERE p.id IN (
    SELECT c.id FROM public.prospect_studios c
    WHERE (c.enrichment_status = 'pending'
           OR (c.enrichment_status = 'processing' AND c.claimed_at < now() - interval '15 minutes'))
      AND c.enrichment_attempts < 3
    ORDER BY c.created_at ASC
    FOR UPDATE SKIP LOCKED
    LIMIT GREATEST(1, LEAST(coalesce(batch_size, 5), 25))
  )
  RETURNING p.*;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_prospect_enrichment(integer) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_prospect_enrichment(integer) TO service_role;