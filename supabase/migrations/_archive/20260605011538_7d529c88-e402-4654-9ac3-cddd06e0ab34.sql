
CREATE TABLE public.cad_fit_edit_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  session_id text,
  field text NOT NULL CHECK (field IN ('cad_document_id','room_label','product_id','clearance_mm','initial','confirm')),
  requested_value text,
  resolved_value text,
  outcome text NOT NULL CHECK (outcome IN ('accepted','rejected')),
  reason text,
  cad_document_id uuid,
  room_label text,
  product_id uuid,
  clearance_mm integer,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.cad_fit_edit_audit TO authenticated;
GRANT ALL ON public.cad_fit_edit_audit TO service_role;

ALTER TABLE public.cad_fit_edit_audit ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read their own fit edit audit"
  ON public.cad_fit_edit_audit FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE INDEX cad_fit_edit_audit_user_created_idx
  ON public.cad_fit_edit_audit (user_id, created_at DESC);
