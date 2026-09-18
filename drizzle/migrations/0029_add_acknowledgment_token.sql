ALTER TABLE public.designer_purchase_orders
  ADD COLUMN IF NOT EXISTS acknowledgment_token uuid DEFAULT gen_random_uuid();

UPDATE public.designer_purchase_orders
SET acknowledgment_token = ack_token
WHERE acknowledgment_token IS NULL AND ack_token IS NOT NULL;

ALTER TABLE public.designer_purchase_orders
  ALTER COLUMN acknowledgment_token SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS designer_purchase_orders_acknowledgment_token_key
  ON public.designer_purchase_orders (acknowledgment_token);