CREATE TABLE public.product_image_embeddings (
  pick_id uuid PRIMARY KEY,
  designer_name text,
  title text,
  image_url text,
  embedding vector(3072),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.product_image_embeddings TO authenticated;
GRANT ALL ON public.product_image_embeddings TO service_role;

ALTER TABLE public.product_image_embeddings ENABLE ROW LEVEL SECURITY;

CREATE INDEX product_image_embeddings_embedding_hnsw
  ON public.product_image_embeddings
  USING hnsw ((embedding::halfvec(3072)) halfvec_cosine_ops);

CREATE OR REPLACE FUNCTION public.match_product_images(query_embedding vector(3072), match_count int DEFAULT 8)
RETURNS TABLE(pick_id uuid, title text, designer_name text, image_url text, similarity float)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT e.pick_id, e.title, e.designer_name, e.image_url,
         1 - (e.embedding::halfvec(3072) <=> query_embedding::halfvec(3072)) AS similarity
  FROM public.product_image_embeddings e
  JOIN public.designer_curator_picks p ON p.id = e.pick_id
  WHERE p.is_hidden = false
    AND p.hidden_in_studio = false
    AND e.embedding IS NOT NULL
  ORDER BY e.embedding::halfvec(3072) <=> query_embedding::halfvec(3072)
  LIMIT GREATEST(1, LEAST(match_count, 24))
$$;

GRANT EXECUTE ON FUNCTION public.match_product_images(vector(3072), int) TO authenticated;
GRANT EXECUTE ON FUNCTION public.match_product_images(vector(3072), int) TO service_role;