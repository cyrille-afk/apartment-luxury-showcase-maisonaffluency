ALTER TABLE public.payment_credentials
  ADD COLUMN IF NOT EXISTS test_publishable_key text,
  ADD COLUMN IF NOT EXISTS test_secret_key text,
  ADD COLUMN IF NOT EXISTS test_webhook_secret text;