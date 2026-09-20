-- Article 28 sub-processor inventory: every external vendor that touches
-- personal data, the state of its data-processing agreement, and the lawful
-- transfer mechanism relied upon for data leaving the EEA.
CREATE TYPE public.dpa_status AS ENUM ('pending', 'signed', 'executed');

CREATE TABLE public.sub_processor_registry (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_name TEXT NOT NULL,
  service TEXT NOT NULL,
  purpose TEXT NOT NULL,
  data_categories TEXT NOT NULL,
  entity_country TEXT NOT NULL,
  hosting_regions TEXT,
  website TEXT,
  privacy_url TEXT,
  dpa_url TEXT,
  dpa_status public.dpa_status NOT NULL DEFAULT 'pending',
  dpa_reference TEXT,
  dpa_countersigned_at TIMESTAMPTZ,
  transfer_mechanism TEXT,
  last_reviewed_at TIMESTAMPTZ,
  reviewed_by UUID,
  notes TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 100,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (vendor_name, service)
);

-- Admin-only register: no anon grant.
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sub_processor_registry TO authenticated;
GRANT ALL ON public.sub_processor_registry TO service_role;

ALTER TABLE public.sub_processor_registry ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins read sub-processors"
  ON public.sub_processor_registry FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY "Admins insert sub-processors"
  ON public.sub_processor_registry FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY "Admins update sub-processors"
  ON public.sub_processor_registry FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY "Admins delete sub-processors"
  ON public.sub_processor_registry FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'));

CREATE INDEX IF NOT EXISTS idx_sub_processor_registry_active
  ON public.sub_processor_registry (is_active, sort_order);

CREATE TRIGGER trg_sub_processor_registry_updated_at
  BEFORE UPDATE ON public.sub_processor_registry
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();