
CREATE TABLE IF NOT EXISTS public.concierge_roster_embeddings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  specialty TEXT,
  embedding vector(1536) NOT NULL,
  model_version TEXT NOT NULL DEFAULT 'openai/text-embedding-3-small',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT ALL ON public.concierge_roster_embeddings TO service_role;

ALTER TABLE public.concierge_roster_embeddings ENABLE ROW LEVEL SECURITY;

-- No client-facing policies: only the service role (edge functions) reads
-- this table. Service role bypasses RLS, so no policy needed for it.

CREATE INDEX IF NOT EXISTS concierge_roster_embeddings_hnsw_idx
  ON public.concierge_roster_embeddings
  USING hnsw (embedding vector_cosine_ops);

CREATE OR REPLACE FUNCTION public.match_roster_public(
  query_embedding vector(1536),
  match_count int DEFAULT 6
)
RETURNS TABLE (
  name TEXT,
  specialty TEXT,
  similarity FLOAT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    r.name,
    r.specialty,
    1 - (r.embedding <=> query_embedding) AS similarity
  FROM public.concierge_roster_embeddings r
  ORDER BY r.embedding <=> query_embedding
  LIMIT GREATEST(1, LEAST(match_count, 20));
$$;

REVOKE ALL ON FUNCTION public.match_roster_public(vector, int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.match_roster_public(vector, int) TO service_role;

CREATE TRIGGER update_concierge_roster_embeddings_updated_at
BEFORE UPDATE ON public.concierge_roster_embeddings
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
