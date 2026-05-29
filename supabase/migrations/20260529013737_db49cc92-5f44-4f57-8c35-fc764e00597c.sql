-- Add Ship-to (delivery) address fields, distinct from Bill-to/Client.
-- Also capture incoterm and DAP/DDP/EXW flags for international orders.

ALTER TABLE public.trade_quotes
  ADD COLUMN IF NOT EXISTS ship_to_name        text,
  ADD COLUMN IF NOT EXISTS ship_to_attention   text,
  ADD COLUMN IF NOT EXISTS ship_to_address1    text,
  ADD COLUMN IF NOT EXISTS ship_to_address2    text,
  ADD COLUMN IF NOT EXISTS ship_to_city        text,
  ADD COLUMN IF NOT EXISTS ship_to_state       text,
  ADD COLUMN IF NOT EXISTS ship_to_postal_code text,
  ADD COLUMN IF NOT EXISTS ship_to_country     text,
  ADD COLUMN IF NOT EXISTS ship_to_phone       text,
  ADD COLUMN IF NOT EXISTS ship_to_email       text,
  ADD COLUMN IF NOT EXISTS ship_to_notes       text,
  ADD COLUMN IF NOT EXISTS incoterm            text,
  ADD COLUMN IF NOT EXISTS ship_to_same_as_bill boolean NOT NULL DEFAULT true;

ALTER TABLE public.trade_quotes
  DROP CONSTRAINT IF EXISTS trade_quotes_incoterm_check;
ALTER TABLE public.trade_quotes
  ADD CONSTRAINT trade_quotes_incoterm_check
  CHECK (incoterm IS NULL OR incoterm IN ('EXW','FCA','FOB','CIF','CIP','DAP','DDP','DPU'));

ALTER TABLE public.order_timeline
  ADD COLUMN IF NOT EXISTS ship_to_name        text,
  ADD COLUMN IF NOT EXISTS ship_to_attention   text,
  ADD COLUMN IF NOT EXISTS ship_to_address1    text,
  ADD COLUMN IF NOT EXISTS ship_to_address2    text,
  ADD COLUMN IF NOT EXISTS ship_to_city        text,
  ADD COLUMN IF NOT EXISTS ship_to_state       text,
  ADD COLUMN IF NOT EXISTS ship_to_postal_code text,
  ADD COLUMN IF NOT EXISTS ship_to_country     text,
  ADD COLUMN IF NOT EXISTS ship_to_phone       text,
  ADD COLUMN IF NOT EXISTS ship_to_email       text,
  ADD COLUMN IF NOT EXISTS ship_to_notes       text,
  ADD COLUMN IF NOT EXISTS incoterm            text;

ALTER TABLE public.order_timeline
  DROP CONSTRAINT IF EXISTS order_timeline_incoterm_check;
ALTER TABLE public.order_timeline
  ADD CONSTRAINT order_timeline_incoterm_check
  CHECK (incoterm IS NULL OR incoterm IN ('EXW','FCA','FOB','CIF','CIP','DAP','DDP','DPU'));