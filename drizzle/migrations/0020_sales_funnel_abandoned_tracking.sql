-- Abandoned shopping bags (server-side mirror of the client basket)
CREATE TABLE public.abandoned_carts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id text NOT NULL UNIQUE,
  user_id uuid,
  email text,
  name text,
  currency text,
  item_count integer NOT NULL DEFAULT 0,
  subtotal_cents integer NOT NULL DEFAULT 0,
  items jsonb NOT NULL DEFAULT '[]'::jsonb,
  status text NOT NULL DEFAULT 'active',
  reminder_count integer NOT NULL DEFAULT 0,
  last_reminder_at timestamptz,
  last_activity_at timestamptz NOT NULL DEFAULT now(),
  recovered_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_abandoned_carts_status_activity ON public.abandoned_carts (status, last_activity_at DESC);

GRANT SELECT, UPDATE, DELETE ON public.abandoned_carts TO authenticated;
GRANT ALL ON public.abandoned_carts TO service_role;

ALTER TABLE public.abandoned_carts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins read abandoned carts"
  ON public.abandoned_carts FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY "Admins update abandoned carts"
  ON public.abandoned_carts FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY "Admins delete abandoned carts"
  ON public.abandoned_carts FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'));

-- Audit trail of every automatic funnel reminder
CREATE TABLE public.funnel_reminder_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type text NOT NULL,
  entity_id text NOT NULL,
  stage text NOT NULL,
  reminder_number integer NOT NULL DEFAULT 1,
  recipient_email text,
  audience text NOT NULL DEFAULT 'client',
  template_name text,
  sent_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (entity_type, entity_id, reminder_number)
);

CREATE INDEX idx_funnel_reminder_log_sent ON public.funnel_reminder_log (sent_at DESC);

GRANT SELECT ON public.funnel_reminder_log TO authenticated;
GRANT ALL ON public.funnel_reminder_log TO service_role;

ALTER TABLE public.funnel_reminder_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins read funnel reminders"
  ON public.funnel_reminder_log FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'));