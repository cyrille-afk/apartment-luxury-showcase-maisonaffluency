CREATE TABLE IF NOT EXISTS public.funnel_reminder_pauses (
  entity_type text NOT NULL,
  entity_id text NOT NULL,
  paused boolean NOT NULL DEFAULT true,
  reason text,
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (entity_type, entity_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.funnel_reminder_pauses TO authenticated;
GRANT ALL ON public.funnel_reminder_pauses TO service_role;

ALTER TABLE public.funnel_reminder_pauses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage reminder pauses"
ON public.funnel_reminder_pauses
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'));

ALTER TABLE public.funnel_reminder_log
  ADD COLUMN IF NOT EXISTS resolved_at timestamptz,
  ADD COLUMN IF NOT EXISTS resolved_reason text;