
-- Client type enum
DO $$ BEGIN
  CREATE TYPE public.client_type AS ENUM ('company', 'studio', 'individual');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Clients table
CREATE TABLE public.clients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  studio_id uuid NOT NULL REFERENCES public.studios(id) ON DELETE CASCADE,
  created_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  name text NOT NULL,
  type public.client_type NOT NULL DEFAULT 'company',
  website text,
  tax_id text,
  default_currency text,
  billing_address_line1 text,
  billing_address_line2 text,
  billing_city text,
  billing_region text,
  billing_postal_code text,
  billing_country text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_clients_studio ON public.clients(studio_id);
CREATE INDEX idx_clients_name ON public.clients(studio_id, lower(name));

ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Studio members view clients"
  ON public.clients FOR SELECT TO authenticated
  USING (public.can_view_studio(auth.uid(), studio_id));

CREATE POLICY "Studio editors insert clients"
  ON public.clients FOR INSERT TO authenticated
  WITH CHECK (public.can_edit_studio(auth.uid(), studio_id) AND created_by = auth.uid());

CREATE POLICY "Studio editors update clients"
  ON public.clients FOR UPDATE TO authenticated
  USING (public.can_edit_studio(auth.uid(), studio_id))
  WITH CHECK (public.can_edit_studio(auth.uid(), studio_id));

CREATE POLICY "Studio editors delete clients"
  ON public.clients FOR DELETE TO authenticated
  USING (public.can_edit_studio(auth.uid(), studio_id));

CREATE TRIGGER trg_clients_updated_at
  BEFORE UPDATE ON public.clients
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Client contacts table
CREATE TABLE public.client_contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  first_name text NOT NULL DEFAULT '',
  last_name text NOT NULL DEFAULT '',
  role_title text,
  email text,
  phone text,
  is_primary boolean NOT NULL DEFAULT false,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_client_contacts_client ON public.client_contacts(client_id);
CREATE UNIQUE INDEX idx_client_contacts_one_primary
  ON public.client_contacts(client_id) WHERE is_primary = true;

ALTER TABLE public.client_contacts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Studio members view contacts"
  ON public.client_contacts FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.clients c
    WHERE c.id = client_contacts.client_id
      AND public.can_view_studio(auth.uid(), c.studio_id)
  ));

CREATE POLICY "Studio editors insert contacts"
  ON public.client_contacts FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.clients c
    WHERE c.id = client_contacts.client_id
      AND public.can_edit_studio(auth.uid(), c.studio_id)
  ));

CREATE POLICY "Studio editors update contacts"
  ON public.client_contacts FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.clients c
    WHERE c.id = client_contacts.client_id
      AND public.can_edit_studio(auth.uid(), c.studio_id)
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.clients c
    WHERE c.id = client_contacts.client_id
      AND public.can_edit_studio(auth.uid(), c.studio_id)
  ));

CREATE POLICY "Studio editors delete contacts"
  ON public.client_contacts FOR DELETE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.clients c
    WHERE c.id = client_contacts.client_id
      AND public.can_edit_studio(auth.uid(), c.studio_id)
  ));

CREATE TRIGGER trg_client_contacts_updated_at
  BEFORE UPDATE ON public.client_contacts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Link projects and quotes to a client (nullable; legacy free-text client_name preserved)
ALTER TABLE public.projects
  ADD COLUMN client_id uuid REFERENCES public.clients(id) ON DELETE SET NULL;
CREATE INDEX idx_projects_client_id ON public.projects(client_id);

ALTER TABLE public.trade_quotes
  ADD COLUMN client_id uuid REFERENCES public.clients(id) ON DELETE SET NULL;
CREATE INDEX idx_trade_quotes_client_id ON public.trade_quotes(client_id);
