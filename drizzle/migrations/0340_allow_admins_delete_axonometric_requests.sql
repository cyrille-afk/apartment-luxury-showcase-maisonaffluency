DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'axonometric_requests'
      AND policyname = 'Admins can delete all axonometric requests'
  ) THEN
    CREATE POLICY "Admins can delete all axonometric requests"
      ON public.axonometric_requests
      FOR DELETE
      TO authenticated
      USING (public.has_role(auth.uid(), 'admin'::public.app_role));
  END IF;
END $$;