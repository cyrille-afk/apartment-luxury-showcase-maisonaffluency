ALTER TABLE public.cad_fit_edit_audit
  DROP CONSTRAINT IF EXISTS cad_fit_edit_audit_failed_validation_check;

ALTER TABLE public.cad_fit_edit_audit
  ADD CONSTRAINT cad_fit_edit_audit_failed_validation_check
  CHECK (
    failed_validation IS NULL
    OR failed_validation IN (
      'plan_not_found',
      'plan_not_ready',
      'plan_ambiguous',
      'room_not_detected',
      'room_ambiguous',
      'piece_not_found',
      'piece_ambiguous',
      'missing_dimensions',
      'clearance_out_of_range',
      'clearance_unparseable',
      'missing_field',
      'service_unreachable',
      'no_verdict',
      'other'
    )
  );