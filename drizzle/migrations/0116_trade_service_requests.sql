CREATE TABLE public.trade_service_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  first_name text NOT NULL CHECK (char_length(first_name) BETWEEN 1 AND 100),
  last_name text NOT NULL CHECK (char_length(last_name) BETWEEN 1 AND 100),
  company_name text NOT NULL CHECK (char_length(company_name) BETWEEN 1 AND 200),
  phone text NOT NULL CHECK (char_length(phone) BETWEEN 3 AND 40),
  email text NOT NULL CHECK (char_length(email) BETWEEN 3 AND 255),
  postal_code text NOT NULL CHECK (char_length(postal_code) BETWEEN 1 AND 20),
  country text NOT NULL CHECK (char_length(country) BETWEEN 1 AND 80),
  preferred_contact text NOT NULL CHECK (preferred_contact IN ('Email','Phone','WhatsApp')),
  service_type text NOT NULL CHECK (char_length(service_type) BETWEEN 1 AND 80),
  status text NOT NULL DEFAULT 'new',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT INSERT ON public.trade_service_requests TO anon, authenticated;
GRANT SELECT, UPDATE, DELETE ON public.trade_service_requests TO authenticated;
GRANT ALL ON public.trade_service_requests TO service_role;
ALTER TABLE public.trade_service_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can submit a service request" ON public.trade_service_requests FOR INSERT TO anon, authenticated WITH CHECK (status = 'new');
CREATE POLICY "Admins read service requests" ON public.trade_service_requests FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins update service requests" ON public.trade_service_requests FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins delete service requests" ON public.trade_service_requests FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));