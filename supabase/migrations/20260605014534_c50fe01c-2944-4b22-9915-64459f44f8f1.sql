ALTER TABLE public.cad_fit_edit_audit
  ADD COLUMN IF NOT EXISTS batch_id uuid;

CREATE INDEX IF NOT EXISTS cad_fit_edit_audit_batch_id_idx
  ON public.cad_fit_edit_audit (batch_id)
  WHERE batch_id IS NOT NULL;