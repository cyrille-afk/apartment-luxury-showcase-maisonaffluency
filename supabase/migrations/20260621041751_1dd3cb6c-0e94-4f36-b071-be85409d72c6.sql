
CREATE TABLE public.axonometric_cad_qa (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  mode text NOT NULL,
  product_id text NOT NULL,
  product_name text,
  brand_name text,
  expected_bbox_mm jsonb,
  expected_dim_text text,
  applied_dim_text text,
  original_dim_text text,
  status text NOT NULL CHECK (status IN ('match','mismatch','no_cad','cad_unparsed')),
  delta_cm jsonb,
  tolerance_cm int NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX axonometric_cad_qa_status_idx ON public.axonometric_cad_qa(status, created_at DESC);
CREATE INDEX axonometric_cad_qa_product_idx ON public.axonometric_cad_qa(product_id, created_at DESC);
CREATE INDEX axonometric_cad_qa_user_idx ON public.axonometric_cad_qa(user_id, created_at DESC);

GRANT SELECT ON public.axonometric_cad_qa TO authenticated;
GRANT ALL ON public.axonometric_cad_qa TO service_role;

ALTER TABLE public.axonometric_cad_qa ENABLE ROW LEVEL SECURITY;

CREATE POLICY "axo_cad_qa admins read all"
  ON public.axonometric_cad_qa FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "axo_cad_qa owner reads own"
  ON public.axonometric_cad_qa FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());
