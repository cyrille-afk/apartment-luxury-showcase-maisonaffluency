ALTER TABLE public.trade_program_signups
  ADD COLUMN IF NOT EXISTS phone_number text;

ALTER TABLE public.trade_accounts
  ADD COLUMN IF NOT EXISTS phone_number text;

ALTER TABLE public.trade_program_signups
  ADD CONSTRAINT trade_program_signups_phone_length
  CHECK (phone_number IS NULL OR char_length(phone_number) BETWEEN 7 AND 30);

ALTER TABLE public.trade_accounts
  ADD CONSTRAINT trade_accounts_phone_length
  CHECK (phone_number IS NULL OR char_length(phone_number) BETWEEN 7 AND 30);