CREATE TABLE public.quote_payment_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_id uuid NOT NULL REFERENCES public.trade_quotes(id) ON DELETE CASCADE,
  token text NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(16), 'hex'),
  amount_cents integer NOT NULL CHECK (amount_cents > 0),
  currency text NOT NULL,
  label text NOT NULL DEFAULT 'Full payment',
  payer_email text,
  payer_name text,
  status text NOT NULL DEFAULT 'active',
  stripe_session_id text,
  paid_at timestamptz,
  expires_at timestamptz,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX quote_payment_links_quote_id_idx ON public.quote_payment_links(quote_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.quote_payment_links TO authenticated;
GRANT ALL ON public.quote_payment_links TO service_role;

ALTER TABLE public.quote_payment_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage quote payment links"
ON public.quote_payment_links
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Quote owners view their payment links"
ON public.quote_payment_links
FOR SELECT
TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.trade_quotes q
  WHERE q.id = quote_payment_links.quote_id AND q.user_id = auth.uid()
));