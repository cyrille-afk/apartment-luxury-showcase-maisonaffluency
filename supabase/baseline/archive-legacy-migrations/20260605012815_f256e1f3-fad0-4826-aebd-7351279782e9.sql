ALTER TABLE public.cad_fit_edit_audit
  DROP CONSTRAINT IF EXISTS cad_fit_edit_audit_field_check;

ALTER TABLE public.cad_fit_edit_audit
  ADD CONSTRAINT cad_fit_edit_audit_field_check
  CHECK (field IN ('cad_document_id','room_label','product_id','clearance_mm','initial','confirm','cancel','result'));

ALTER TABLE public.cad_fit_edit_audit
  ADD COLUMN IF NOT EXISTS verdict text,
  ADD COLUMN IF NOT EXISTS turns_since_confirm integer;