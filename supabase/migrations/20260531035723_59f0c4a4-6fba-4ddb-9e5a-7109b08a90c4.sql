
CREATE TABLE public.concierge_rag_traces (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  query text NOT NULL,
  matches jsonb NOT NULL DEFAULT '[]'::jsonb,
  context_text text,
  match_count int NOT NULL DEFAULT 0,
  top_similarity float,
  used_in_answer boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.concierge_rag_traces TO authenticated;
GRANT ALL ON public.concierge_rag_traces TO service_role;

ALTER TABLE public.concierge_rag_traces ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view all rag traces"
ON public.concierge_rag_traces
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE INDEX idx_concierge_rag_traces_created_at ON public.concierge_rag_traces (created_at DESC);
CREATE INDEX idx_concierge_rag_traces_user_id ON public.concierge_rag_traces (user_id);
