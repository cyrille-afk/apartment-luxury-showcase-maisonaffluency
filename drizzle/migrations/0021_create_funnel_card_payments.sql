CREATE TABLE public.funnel_card_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  card_id text NOT NULL,
  card_stage text,
  label text,
  amount_cents integer NOT NULL,
  expected_total_cents integer,
  currency text NOT NULL DEFAULT 'USD',
  payment_kind text NOT NULL DEFAULT 'full',
  status text NOT NULL DEFAULT 'pending',
  stripe_session_id text UNIQUE,
  stripe_payment_intent_id text,
  payer_email text,
  quote_id uuid,
  paid_at timestamptz,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_funnel_card_payments_card ON public.funnel_card_payments (card_id);

GRANT SELECT ON public.funnel_card_payments TO authenticated;
GRANT ALL ON public.funnel_card_payments TO service_role;

ALTER TABLE public.funnel_card_payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view funnel card payments"
ON public.funnel_card_payments
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'));

ALTER TABLE public.funnel_card_payments REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.funnel_card_payments;