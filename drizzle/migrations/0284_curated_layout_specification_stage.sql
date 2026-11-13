DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT conrelid::regclass AS tbl, conname FROM pg_constraint
    WHERE contype = 'c' AND conrelid IN ('public.project_specification_progress'::regclass, 'public.project_specification_targets'::regclass)
      AND pg_get_constraintdef(oid) ILIKE '%stage%'
  LOOP
    EXECUTE format('ALTER TABLE %s DROP CONSTRAINT %I', r.tbl, r.conname);
  END LOOP;
END $$;
ALTER TABLE public.project_specification_progress ADD CONSTRAINT project_specification_progress_stage_check
  CHECK (stage IN ('mood-board','comparator','annotation','visualiser','curated-layout','tearsheet','specification-sheet','ffe-schedule','quote'));
ALTER TABLE public.project_specification_targets ADD CONSTRAINT project_specification_targets_stage_check
  CHECK (stage IN ('mood-board','comparator','annotation','visualiser','curated-layout','tearsheet','specification-sheet','ffe-schedule','quote'));