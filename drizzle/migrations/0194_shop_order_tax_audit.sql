CREATE TABLE public.shop_order_tax_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.shop_orders(id) ON DELETE CASCADE,
  changed_at timestamptz NOT NULL DEFAULT now(),
  actor_id uuid,
  actor_email text,
  actor_kind text NOT NULL DEFAULT 'team',
  before_tax_cents integer, after_tax_cents integer NOT NULL,
  before_tax_label text, after_tax_label text,
  before_buyer_tax_id text, after_buyer_tax_id text,
  before_total_cents integer, after_total_cents integer NOT NULL,
  buyer_emailed boolean NOT NULL DEFAULT false
);
CREATE INDEX shop_order_tax_audit_order_idx ON public.shop_order_tax_audit (order_id, changed_at DESC);
GRANT SELECT ON public.shop_order_tax_audit TO authenticated;
GRANT ALL ON public.shop_order_tax_audit TO service_role;
ALTER TABLE public.shop_order_tax_audit ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins read tax audit" ON public.shop_order_tax_audit FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));