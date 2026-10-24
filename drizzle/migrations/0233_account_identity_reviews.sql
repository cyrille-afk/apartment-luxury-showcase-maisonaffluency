CREATE TABLE public.account_identity_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email_key text NOT NULL,
  primary_user_id uuid NOT NULL,
  duplicate_user_id uuid NOT NULL,
  password_verified boolean NOT NULL DEFAULT false,
  google_verified boolean NOT NULL DEFAULT false,
  decision text NOT NULL CHECK (decision IN ('keep_both','suspend_duplicate','restore_duplicate')),
  notes text CHECK (char_length(notes) <= 2000),
  reviewed_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.account_identity_reviews TO authenticated;
GRANT ALL ON public.account_identity_reviews TO service_role;
ALTER TABLE public.account_identity_reviews ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins read identity reviews" ON public.account_identity_reviews
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE INDEX account_identity_reviews_email_idx ON public.account_identity_reviews (email_key, created_at DESC);