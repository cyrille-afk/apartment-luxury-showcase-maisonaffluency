INSERT INTO storage.buckets (id, name, public) VALUES ('designer-images', 'designer-images', true) ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Public read designer images" ON storage.objects FOR SELECT TO anon, authenticated USING (bucket_id = 'designer-images');
CREATE POLICY "Auth upload designer images" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'designer-images');