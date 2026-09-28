CREATE TABLE public.acquisition_demo_bookings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid NOT NULL REFERENCES public.acquisition_leads(id) ON DELETE CASCADE,
  template_key text NOT NULL,
  demo_at timestamptz,
  booking_link text,
  trade_id_audit jsonb NOT NULL DEFAULT '{}'::jsonb,
  audit_status text NOT NULL DEFAULT 'pending' CHECK (audit_status IN ('pending','in_review','verified','flagged')),
  notes text,
  created_by uuid DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX acquisition_demo_bookings_lead_idx ON public.acquisition_demo_bookings(lead_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.acquisition_demo_bookings TO authenticated;
GRANT ALL ON public.acquisition_demo_bookings TO service_role;
ALTER TABLE public.acquisition_demo_bookings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage demo bookings" ON public.acquisition_demo_bookings
FOR ALL TO authenticated
USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin'))
WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin'));