-- Step 9: RAG infrastructure — pgvector + embedding columns + match RPC
CREATE EXTENSION IF NOT EXISTS vector;

-- Embedding columns (1536 dims to match openai/text-embedding-3-small, the cheapest tier)
ALTER TABLE public.trade_products
  ADD COLUMN IF NOT EXISTS embedding vector(1536),
  ADD COLUMN IF NOT EXISTS embedding_source_hash text,
  ADD COLUMN IF NOT EXISTS embedded_at timestamptz;

ALTER TABLE public.designer_curator_picks
  ADD COLUMN IF NOT EXISTS embedding vector(1536),
  ADD COLUMN IF NOT EXISTS embedding_source_hash text,
  ADD COLUMN IF NOT EXISTS embedded_at timestamptz;

-- HNSW indexes for cosine similarity
CREATE INDEX IF NOT EXISTS trade_products_embedding_idx
  ON public.trade_products USING hnsw (embedding vector_cosine_ops);

CREATE INDEX IF NOT EXISTS designer_curator_picks_embedding_idx
  ON public.designer_curator_picks USING hnsw (embedding vector_cosine_ops);

-- Unified search across both catalog tables for the trade concierge
CREATE OR REPLACE FUNCTION public.match_catalog(
  query_embedding vector(1536),
  match_count int DEFAULT 40
)
RETURNS TABLE (
  id uuid,
  source text,
  title text,
  designer text,
  materials text,
  category text,
  subcategory text,
  similarity float
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH picks AS (
    SELECT
      p.id,
      'curator'::text AS source,
      p.title,
      COALESCE(d.display_name, d.name, 'Unknown') AS designer,
      p.materials,
      p.category,
      p.subcategory,
      1 - (p.embedding <=> query_embedding) AS similarity
    FROM public.designer_curator_picks p
    LEFT JOIN public.designers d ON d.id = p.designer_id
    WHERE p.embedding IS NOT NULL
    ORDER BY p.embedding <=> query_embedding
    LIMIT match_count
  ),
  trades AS (
    SELECT
      t.id,
      'trade'::text AS source,
      t.product_name AS title,
      COALESCE(NULLIF(split_part(t.brand_name, ' - ', 1), ''), t.brand_name, 'Unknown') AS designer,
      t.materials,
      t.category,
      t.subcategory,
      1 - (t.embedding <=> query_embedding) AS similarity
    FROM public.trade_products t
    WHERE t.embedding IS NOT NULL AND t.is_active = true
    ORDER BY t.embedding <=> query_embedding
    LIMIT match_count
  )
  SELECT * FROM picks
  UNION ALL
  SELECT * FROM trades
  ORDER BY similarity DESC
  LIMIT match_count;
$$;

GRANT EXECUTE ON FUNCTION public.match_catalog(vector, int) TO authenticated, service_role;
