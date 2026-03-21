INSERT INTO storage.buckets (id, name, public) VALUES ('spec-sheets', 'spec-sheets', true) ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Spec sheets are publicly accessible" ON storage.objects FOR SELECT USING (bucket_id = 'spec-sheets');

CREATE POLICY "Admins can upload spec sheets" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'spec-sheets' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update spec sheets" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'spec-sheets' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete spec sheets" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'spec-sheets' AND public.has_role(auth.uid(), 'admin'));