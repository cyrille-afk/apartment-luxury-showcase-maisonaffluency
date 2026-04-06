CREATE POLICY "Users can read own taste profile"
ON public.client_taste_profiles
FOR SELECT
TO authenticated
USING (user_id = auth.uid());