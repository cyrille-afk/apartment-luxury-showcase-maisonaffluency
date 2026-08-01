CREATE TABLE public.custom_inquiries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  email text NOT NULL,
  company text,
  requirements text NOT NULL,
  product_id text,
  product_title text,
  designer_name text,
  page_url text,
  status text NOT NULL DEFAULT 'new',
  user_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT INSERT ON public.custom_inquiries TO anon, authenticated;
GRANT SELECT, UPDATE, DELETE ON public.custom_inquiries TO authenticated;
GRANT ALL ON public.custom_inquiries TO service_role;

ALTER TABLE public.custom_inquiries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can submit a customization inquiry"
  ON public.custom_inquiries FOR INSERT TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "Admins can read customization inquiries"
  ON public.custom_inquiries FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY "Admins can update customization inquiries"
  ON public.custom_inquiries FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY "Admins can delete customization inquiries"
  ON public.custom_inquiries FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'));

CREATE TRIGGER update_custom_inquiries_updated_at
  BEFORE UPDATE ON public.custom_inquiries
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();