
CREATE TABLE IF NOT EXISTS public.ai_semantic_cache (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  feature text NOT NULL,
  model text NOT NULL,
  prompt text NOT NULL,
  prompt_hash text NOT NULL,
  embedding vector(1536),
  response_json jsonb NOT NULL,
  prompt_tokens integer,
  completion_tokens integer,
  hits integer NOT NULL DEFAULT 0,
  last_hit_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL
);

CREATE INDEX IF NOT EXISTS ai_semantic_cache_feature_model_idx
  ON public.ai_semantic_cache (feature, model, expires_at);

CREATE INDEX IF NOT EXISTS ai_semantic_cache_embedding_idx
  ON public.ai_semantic_cache USING hnsw (embedding vector_cosine_ops);

GRANT ALL ON public.ai_semantic_cache TO service_role;

ALTER TABLE public.ai_semantic_cache ENABLE ROW LEVEL SECURITY;

-- No policies => only service_role (which bypasses RLS) can read/write.

CREATE OR REPLACE FUNCTION public.match_semantic_cache(
  _feature text,
  _model text,
  _query_embedding vector,
  _threshold double precision DEFAULT 0.92,
  _limit integer DEFAULT 1
)
RETURNS TABLE (
  id uuid,
  prompt text,
  response_json jsonb,
  prompt_tokens integer,
  completion_tokens integer,
  similarity double precision
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    c.id,
    c.prompt,
    c.response_json,
    c.prompt_tokens,
    c.completion_tokens,
    1 - (c.embedding <=> _query_embedding) AS similarity
  FROM public.ai_semantic_cache c
  WHERE c.feature = _feature
    AND c.model = _model
    AND c.embedding IS NOT NULL
    AND c.expires_at > now()
    AND 1 - (c.embedding <=> _query_embedding) >= _threshold
  ORDER BY c.embedding <=> _query_embedding
  LIMIT GREATEST(_limit, 1);
$$;
