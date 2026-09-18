ALTER TABLE public.designer_purchase_orders
  ADD COLUMN IF NOT EXISTS ack_token uuid NOT NULL DEFAULT gen_random_uuid(),
  ADD COLUMN IF NOT EXISTS acknowledged_at timestamptz;

CREATE UNIQUE INDEX IF NOT EXISTS designer_purchase_orders_ack_token_key
  ON public.designer_purchase_orders (ack_token);