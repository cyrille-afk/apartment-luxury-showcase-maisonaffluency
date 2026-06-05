
ALTER TABLE public.cad_fit_edit_audit
  ADD COLUMN IF NOT EXISTS failed_validation text;

ALTER TABLE public.cad_fit_edit_audit
  DROP CONSTRAINT IF EXISTS cad_fit_edit_audit_rejected_requires_reason;

ALTER TABLE public.cad_fit_edit_audit
  ADD CONSTRAINT cad_fit_edit_audit_rejected_requires_reason
  CHECK (
    outcome <> 'rejected'
    OR (
      reason IS NOT NULL AND btrim(reason) <> ''
      AND failed_validation IS NOT NULL AND btrim(failed_validation) <> ''
    )
  );

ALTER TABLE public.cad_fit_edit_audit
  DROP CONSTRAINT IF EXISTS cad_fit_edit_audit_failed_validation_check;

ALTER TABLE public.cad_fit_edit_audit
  ADD CONSTRAINT cad_fit_edit_audit_failed_validation_check
  CHECK (
    failed_validation IS NULL
    OR failed_validation IN (
      'plan_not_found',
      'plan_ambiguous',
      'room_not_detected',
      'room_ambiguous',
      'piece_not_found',
      'piece_ambiguous',
      'clearance_out_of_range',
      'clearance_unparseable',
      'missing_field',
      'other'
    )
  );
